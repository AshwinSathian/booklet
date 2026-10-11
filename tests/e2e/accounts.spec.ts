import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";

// Phase 5a in a real browser: sign-in through GitHub and Google (both
// stubbed by the small server below), passkeys through Chromium's virtual
// authenticator, the offer to move local drafts into a new account, and the
// account page's password, export and delete actions.
//
// The app must be started with the provider settings that point at the
// stub. CI sets them (see the e2e job in .github/workflows/ci.yml):
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SSO_GITHUB_BASE_URL=http://127.0.0.1:3199/github
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SSO_GOOGLE_BASE_URL=http://127.0.0.1:3199/google

const STUB_PORT = 3199;
const PASSWORD = "accounts-e2e-correct-horse";
const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;

// One address per file for the per-IP signup limit, so this spec neither
// uses up nor depends on what other specs left of it.
test.use({ extraHTTPHeaders: { "cf-connecting-ip": `2001:db8::${Math.random().toString(16).slice(2, 6)}` } });

/** What the stubbed providers say about whoever is "signing in". */
const person = { email: "", githubId: 0, googleSub: "" };
let stub: Server;

test.beforeAll(async () => {
  stub = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${STUB_PORT}`);
    const json = (body: unknown) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    // The consent screen: approve at once and send the browser back.
    if (url.pathname === "/github/login/oauth/authorize" || url.pathname === "/google/authorize") {
      const back = new URL(url.searchParams.get("redirect_uri")!);
      back.searchParams.set("code", "stub-code");
      back.searchParams.set("state", url.searchParams.get("state")!);
      res.writeHead(302, { location: back.toString() });
      return res.end();
    }
    if (url.pathname === "/github/login/oauth/access_token" || url.pathname === "/google/token") return json({ access_token: "stub-token", token_type: "bearer" });
    if (url.pathname === "/github/user") return json({ id: person.githubId, email: null });
    if (url.pathname === "/github/user/emails") return json([{ email: person.email, primary: true, verified: true }]);
    if (url.pathname === "/google/userinfo") return json({ sub: person.googleSub, email: person.email, email_verified: true });
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => stub.listen(STUB_PORT, "127.0.0.1", resolve));
});

test.afterAll(async () => {
  await new Promise((resolve) => stub.close(resolve));
});

const whoAmI = async (page: Page) =>
  (await (await page.request.get("/api/auth/me")).json()) as { userId: string | null; email: string | null; emailVerified: boolean };

async function signUp(page: Page, tag: string) {
  const email = uniqueEmail(tag);
  const res = await page.request.post("/api/auth/signup", { data: { email, password: PASSWORD } });
  expect(res.status()).toBe(201);
  return email;
}

test("GitHub creates an account, and Google with the same verified email signs in to it", async ({ page }) => {
  person.email = uniqueEmail("sso");
  person.githubId = Math.floor(Math.random() * 1e9);
  person.googleSub = `google-${Math.random().toString(36).slice(2)}`;

  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Continue with GitHub" }).click();
  await expect(page).toHaveURL(/\/app$/);
  const first = await whoAmI(page);
  expect(first.email).toBe(person.email);
  expect(first.emailVerified).toBe(true);

  await page.request.post("/api/auth/logout");
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect((await whoAmI(page)).userId).toBe(first.userId);

  // Both show as connected, and one can be disconnected because the other remains.
  await page.goto("/settings/security");
  await expect(page.getByRole("button", { name: "Disconnect" })).toHaveCount(2);
  await page.getByRole("button", { name: "Disconnect" }).first().click();
  await expect(page.getByRole("status")).toContainText("disconnected");
  await expect(page.getByRole("link", { name: "Connect" })).toHaveCount(1);
});

test("a provider callback that this browser did not start is refused", async ({ page }) => {
  await page.goto("/api/auth/sso/github/callback?code=stub-code&state=forged");
  await expect(page).toHaveURL(/\/sign-in\?error=sso_state/);
  await expect(page.locator('p[role="alert"]')).toContainText("did not start in this browser");
  expect((await whoAmI(page)).userId).toBeNull();
});

test("after the first sign-in, local drafts can be moved into the account", async ({ page }) => {
  await page.goto("/app");
  const editor = page.locator("textarea").first();
  await editor.fill("# Written before signing in\n\nKeep me.");
  // Autosave writes the draft to localStorage.
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("booklet:draftsDb") ?? "")).toContain("Written before signing in");
  const draftId = await page.evaluate(() => window.localStorage.getItem("booklet:activeDraftId"));

  await signUp(page, "drafts");
  expect(((await (await page.request.get("/api/drafts")).json()) as { drafts: unknown[] }).drafts).toHaveLength(0);

  await page.reload();
  await expect(page.getByText("1 draft on this device is not in your account.")).toBeVisible();
  await page.getByRole("button", { name: "Move draft" }).click();
  await expect(page.getByText("is not in your account")).toHaveCount(0);

  await expect
    .poll(async () => ((await (await page.request.get("/api/drafts")).json()) as { drafts: Array<{ id: string }> }).drafts.map((d) => d.id))
    .toContain(draftId);
  const stored = (await (await page.request.get(`/api/drafts/${draftId}`)).json()) as { draft: { raw: string } };
  expect(stored.draft.raw).toContain("Keep me.");

  // Answered once: the offer does not come back.
  await page.reload();
  await expect(page.locator("textarea").first()).toBeVisible();
  await expect(page.getByText("is not in your account")).toHaveCount(0);
});

test("a passkey added in Account settings signs in without a password", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The virtual authenticator is a Chromium DevTools feature.");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  });

  await signUp(page, "passkey");
  const { userId } = await whoAmI(page);

  await page.goto("/settings/security");
  await page.getByRole("button", { name: "Add a passkey" }).click();
  await expect(page.getByRole("status")).toContainText("Passkey added");
  await expect(page.getByText("Not used yet")).toBeVisible();

  await page.request.post("/api/auth/logout");
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect((await whoAmI(page)).userId).toBe(userId);
});

test("account page: change password, download pages, delete the account", async ({ page }) => {
  const email = await signUp(page, "account");
  const published = await page.request.post("/api/publish", { data: { raw: "# Export me\n\nBody text." } });
  expect(published.status()).toBe(200);
  const { id } = (await published.json()) as { id: string };
  expect((await page.request.get(`/p/${id}`)).status()).toBe(200);

  // Change password, in its dialog: the old one stops working, this browser stays signed in.
  await page.goto("/settings/security", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Sign-in and security", exact: true })).toBeVisible();
  const NEW_PASSWORD = `${PASSWORD}-changed`;
  await page.getByRole("button", { name: "Change password" }).click();
  const passwordDialog = page.getByRole("dialog", { name: "Change password" });
  // A wrong current password is refused inside the dialog, which stays open.
  await passwordDialog.getByLabel("Current password").fill("not-the-password");
  await passwordDialog.getByLabel("New password").fill(NEW_PASSWORD);
  await passwordDialog.getByRole("button", { name: "Change password" }).click();
  await expect(passwordDialog.getByRole("alert")).toContainText("not correct");
  await passwordDialog.getByLabel("Current password").fill(PASSWORD);
  await passwordDialog.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status")).toContainText("Password saved");
  await expect(passwordDialog).toBeHidden();
  expect((await whoAmI(page)).email).toBe(email);
  const anon = await page.context().browser()!.newContext();
  expect((await anon.request.post("/api/auth/login", { data: { email, password: PASSWORD } })).status()).toBe(401);
  expect((await anon.request.post("/api/auth/login", { data: { email, password: NEW_PASSWORD } })).status()).toBe(200);

  // That second browser is listed, and can be signed out from here without touching this one.
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByText("Signed in on this browser and 1 other")).toBeVisible();
  await page.getByRole("button", { name: "Sign out the others" }).click();
  await expect(page.getByText("Signed in on this browser", { exact: true })).toBeVisible();
  expect((await (await anon.request.get("/api/auth/me")).json()).userId).toBeNull();
  expect((await whoAmI(page)).email).toBe(email);
  await anon.close();

  await page.goto("/settings/account", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
  // The section list marks where you are, and Escape closes a dialog without doing anything.
  await expect(page.getByRole("navigation", { name: "Settings" }).getByRole("link", { name: "Account" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("button", { name: "Change email" }).click();
  await expect(page.getByRole("dialog", { name: "Change email address" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Export: a ZIP that names the page's file.
  const zip = await page.request.get("/api/account/export");
  expect(zip.status()).toBe(200);
  expect(zip.headers()["content-type"]).toBe("application/zip");
  const body = await zip.body();
  expect(body.subarray(0, 2).toString()).toBe("PK");
  expect(body.includes(Buffer.from(`${id}.md`))).toBe(true);

  // Delete: wrong password is refused, the right one removes the account and its page.
  await page.getByRole("button", { name: "Delete account" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Delete account" });
  await deleteDialog.getByLabel("Your password").fill("not-the-password");
  await deleteDialog.getByRole("button", { name: "Delete my account and pages" }).click();
  await expect(deleteDialog.getByRole("alert")).toContainText("not correct");
  await deleteDialog.getByLabel("Your password").fill(NEW_PASSWORD);
  await deleteDialog.getByRole("button", { name: "Delete my account and pages" }).click();
  await expect(page).toHaveURL(/\/$/);

  expect((await whoAmI(page)).userId).toBeNull();
  expect((await page.request.get(`/p/${id}`)).status()).toBe(404);
  const gone = await page.context().browser()!.newContext();
  expect((await gone.request.post("/api/auth/login", { data: { email, password: NEW_PASSWORD } })).status()).toBe(401);
  await gone.close();
});

test("signed out, /settings/account sends you to sign in", async ({ page }) => {
  await page.goto("/settings/account");
  await expect(page).toHaveURL(/\/sign-in/);
});
