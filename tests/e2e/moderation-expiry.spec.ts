import { test, expect, type APIRequestContext } from "@playwright/test";
import { getDb } from "@/lib/mongodb";
import { createApiKey } from "@/lib/db";
import { createUser, getUserById } from "@/lib/db/auth";
import { hashUserPassword } from "@/lib/auth/password";
import { generateRawKey, hashApiKey } from "@/lib/api-key";
import { createId } from "@/lib/id";

// Report → admin queue → takedown → 410, admin gating, and claiming an
// anonymous page — through a real server, including the middleware's
// loopback call to /api/pages/:id/gone, which unit specs can only stub.
//
// Needs a PRODUCTION build (`next build && next start`): `next dev` bypasses
// admin gating entirely. The server and this runner must share one database
// and these settings:
//
//   server:  ADMIN_USER_IDS=e2e-admin  ADMIN_IPS=127.0.0.1
//   both:    MONGODB_URI, API_KEY_PEPPER
//
// The admin account is written straight to the database, because its user
// id has to be known before the server starts.

const ADMIN_ID = "e2e-admin";
const ADMIN_EMAIL = "e2e-admin@example.test";
const PASSWORD = "correct horse battery staple";

// Production resolves the client IP from cf-connecting-ip only; this is
// what puts the test browser on the ADMIN_IPS allowlist.
test.use({ extraHTTPHeaders: { "cf-connecting-ip": "127.0.0.1" } });

test.skip(
  !process.env.MONGODB_URI || !process.env.API_KEY_PEPPER,
  "needs MONGODB_URI and API_KEY_PEPPER matching the server under test",
);

let adminApiKey: string;

test.beforeAll(async () => {
  if (!(await getUserById(ADMIN_ID))) {
    await createUser(ADMIN_ID, ADMIN_EMAIL, await hashUserPassword(PASSWORD));
  }
  adminApiKey = generateRawKey();
  await createApiKey(createId(10), ADMIN_ID, await hashApiKey(adminApiKey), "e2e");
});

test.afterAll(async () => {
  const db = await getDb();
  const pages = await db.collection("pages").find({ user_id: ADMIN_ID }).project({ _id: 1 }).toArray();
  const ids = pages.map((p) => p._id);
  await db.collection("docs").deleteMany({ _id: { $in: ids } });
  await db.collection("reports").deleteMany({ page_id: { $in: ids } } as never);
  await db.collection("pages").deleteMany({ user_id: ADMIN_ID });
  await db.collection("api_keys").deleteMany({ user_id: ADMIN_ID });
});

async function signIn(request: APIRequestContext, email: string) {
  const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.status()).toBe(200);
}

async function signUp(request: APIRequestContext) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const res = await request.post("/api/auth/signup", { data: { email, password: PASSWORD } });
  expect(res.status()).toBe(201);
  return email;
}

test("report a page, take it down from the admin queue, and get 410 on all three routes", async ({ page }) => {
  await signIn(page.request, ADMIN_EMAIL);
  const title = `Reported page ${Date.now()}`;
  const published = await page.request.post("/api/publish", { data: { raw: `# ${title}\n\nBody.` } });
  expect(published.status()).toBe(200);
  const { id } = (await published.json()) as { id: string };
  const v1 = () =>
    page.request.get(`/api/v1/pages/${id}`, { headers: { authorization: `Bearer ${adminApiKey}` } });

  // Before: all three routes serve the page.
  expect((await page.request.get(`/p/${id}`)).status()).toBe(200);
  expect((await page.request.get(`/p/${id}/embed`)).status()).toBe(200);
  expect((await v1()).status()).toBe(200);

  // The embed footer carries the report link too.
  await page.goto(`/p/${id}/embed`);
  await expect(page.getByRole("link", { name: "Report this page" })).toHaveAttribute("href", `/report?page=${id}`);

  // Report it from the share page's footer.
  await page.goto(`/p/${id}`);
  await page.getByRole("link", { name: "Report this page" }).click();
  await expect(page).toHaveURL(new RegExp(`/report\\?page=${id}$`));
  await page.getByLabel("What is wrong with this page?").selectOption("phishing");
  await page.getByLabel("Details (optional)").fill("e2e: fake login form");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Report sent. Thank you.")).toBeVisible();

  // It shows in the admin queue; take the page down.
  await page.goto("/admin/reports");
  const report = page.getByTestId("report").filter({ hasText: `/p/${id}` });
  await expect(report).toContainText("phishing");
  await expect(report).toContainText("e2e: fake login form");
  await report.getByRole("button", { name: "Take down" }).click();
  await expect(report).toHaveCount(0);

  // After: 410 everywhere, with a one-line notice and none of the content.
  for (const path of [`/p/${id}`, `/p/${id}/embed`]) {
    const res = await page.request.get(path);
    expect(res.status(), path).toBe(410);
    const body = await res.text();
    expect(body).toContain("This page was taken down");
    expect(body).not.toContain(title);
  }
  const api = await v1();
  expect(api.status()).toBe(410);
  expect(await api.text()).not.toContain(title);
});

test("a signed-in user who is not an admin gets 404 on /admin/reports", async ({ page }) => {
  await signUp(page.request);
  for (const [path, marker] of [
    ["/admin/reports", "Abuse reports"],
    ["/admin", "Internal Metrics"],
  ]) {
    const res = await page.request.get(path);
    expect(res.status(), path).toBe(404);
    // Status alone is not the test: a layout-only gate returned 404 with the
    // page's data still in the streamed body.
    expect(await res.text(), path).not.toContain(marker);
  }
});

test("a signed-out visitor gets 404 on /admin/reports", async ({ request }) => {
  expect((await request.get("/admin/reports")).status()).toBe(404);
});

test("an anonymous page shows its expiry to its author only, and signing in keeps it", async ({ page, browser }) => {
  const published = await page.request.post("/api/publish", { data: { raw: "# Anonymous e2e\n\nBody." } });
  const { id, owned } = (await published.json()) as { id: string; owned: boolean };
  expect(owned).toBe(false);

  // Another browser sees the page with no notice.
  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  await strangerPage.goto(`/p/${id}`);
  await expect(strangerPage.getByRole("heading", { name: "Anonymous e2e" })).toBeVisible();
  await expect(strangerPage.getByTestId("keep-page-notice")).toHaveCount(0);
  await stranger.close();

  // The author's browser sees the expiry date and the sign-in link.
  await page.goto(`/p/${id}`);
  const notice = page.getByTestId("keep-page-notice");
  await expect(notice).toContainText(/This page expires on \d{1,2} \w+ \d{4}\./);
  await expect(notice.getByRole("link", { name: "Sign in to keep this page" })).toHaveAttribute(
    "href",
    `/sign-in?redirect_url=${encodeURIComponent(`/p/${id}`)}`,
  );

  // Past expiry, readers get 410 while the author's browser still reaches
  // the page and is told when it will be deleted.
  const db = await getDb();
  const original = (await db.collection("docs").findOne({ _id: id } as never))!.expires_at as Date;
  await db.collection("docs").updateOne({ _id: id } as never, { $set: { expires_at: new Date(Date.now() - 86_400_000) } });
  const reader = await browser.newContext({ extraHTTPHeaders: { "cf-connecting-ip": "127.0.0.1" } });
  const asReader = await reader.request.get(`/p/${id}`);
  expect(asReader.status()).toBe(410);
  expect(await asReader.text()).not.toContain("Anonymous e2e");
  await reader.close();
  await page.goto(`/p/${id}`);
  await expect(notice).toContainText(/This page expired on .+ and will be deleted on .+\./);
  await db.collection("docs").updateOne({ _id: id } as never, { $set: { expires_at: original } });

  // Signed in, the same notice offers to keep the page; keeping it ends the expiry.
  await signUp(page.request);
  await page.goto(`/p/${id}`);
  await notice.getByRole("button", { name: "Keep this page" }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Anonymous e2e" })).toBeVisible();

  const doc = await db.collection("docs").findOne({ _id: id } as never);
  expect(doc?.expires_at).toBeUndefined();
  expect(await db.collection("pages").findOne({ _id: id } as never)).toMatchObject({ visibility: "unlisted" });
  await db.collection("docs").deleteOne({ _id: id } as never);
  await db.collection("pages").deleteOne({ _id: id } as never);
});

test("the publish control offers Unlisted, selected, to a signed-in author", async ({ page }) => {
  await signUp(page.request);
  await page.goto("/app");
  const visibility = page.getByLabel("Who can find this page");
  await expect(visibility).toHaveAttribute("data-value", "unlisted");
  await expect(visibility).toHaveText("Unlisted");

  // Choosing Public is sent with the publish and stored.
  await page.locator("textarea").first().fill("# Listed page\n\nBody.");
  await visibility.click();
  await expect(page.getByRole("menuitemradio", { name: /^Unlisted/ })).toHaveAttribute("aria-checked", "true");
  // The pill closes its own menu, and the keyboard reaches every choice.
  await visibility.click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await visibility.click();
  await expect(page.getByRole("menuitemradio", { name: /^Unlisted/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitemradio", { name: /^Public/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await visibility.click();
  await page.getByRole("menuitemradio", { name: /^Public/ }).click();
  await expect(visibility).toHaveText("Public");
  const publish = page.waitForResponse((r) => r.url().endsWith("/api/publish") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const res = await publish;
  expect(res.request().postDataJSON()).toMatchObject({ visibility: "public" });
  const { id } = (await res.json()) as { id: string };
  expect(await (await getDb()).collection("pages").findOne({ _id: id } as never)).toMatchObject({ visibility: "public" });
  await (await getDb()).collection("docs").deleteOne({ _id: id } as never);
  await (await getDb()).collection("pages").deleteOne({ _id: id } as never);
});
