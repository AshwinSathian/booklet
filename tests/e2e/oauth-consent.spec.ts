import { test, expect } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";

// The OAuth consent screen in a real browser: what a person sees when a
// Claude.ai connector asks to sign in, and that nothing is granted before
// they click Allow.

// Its own address for the per-IP signup limit (5 a minute). Without one,
// this spec shares the "unknown" bucket with every spec that ran in the
// same minute, and whether it passed depended on where the minute fell.
test.use({ extraHTTPHeaders: { "cf-connecting-ip": `2001:db8::${Math.random().toString(16).slice(2, 6)}` } });

const CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const PASSWORD = "oauth-e2e-correct-horse";

async function setup(request: import("@playwright/test").APIRequestContext) {
  const reg = await request.post("/api/oauth/register", { data: { client_name: "Claude", redirect_uris: [CALLBACK] } });
  expect(reg.status()).toBe(201);
  const verifier = randomBytes(48).toString("base64url");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: (await reg.json()).client_id,
    redirect_uri: CALLBACK,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    scope: "pages:read pages:write",
    state: "e2e-state",
  });
  return { params, verifier };
}

test("signed out: the authorization page sends you to sign in and back", async ({ page }) => {
  const { params } = await setup(page.request);
  await page.goto(`/oauth/authorize?${params}`);
  await expect(page).toHaveURL(/\/sign-in\?redirect_url=%2Foauth%2Fauthorize/);
});

test("signed in: consent names the app and destination, and Allow returns a working code", async ({ page }) => {
  const { params, verifier } = await setup(page.request);
  const email = `e2e-oauth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const signup = await page.request.post("/api/auth/signup", { data: { email, password: PASSWORD } });
  expect(signup.status()).toBe(201);

  // Stand in for claude.ai, so the test never leaves this machine.
  await page.route("https://claude.ai/**", (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "callback" }));

  await page.goto(`/oauth/authorize?${params}`);
  await expect(page.getByRole("heading", { name: "Connect Claude to Booklet?" })).toBeVisible();
  await expect(page.getByText("claude.ai", { exact: true })).toBeVisible();
  await expect(page.getByText("Publish, update and delete pages")).toBeVisible();
  // Still on Booklet: loading the page redirected nowhere and granted nothing.
  expect(new URL(page.url()).pathname).toBe("/oauth/authorize");

  await page.getByRole("button", { name: "Allow" }).click();
  await page.waitForURL(/^https:\/\/claude\.ai\/api\/mcp\/auth_callback\?/);
  const back = new URL(page.url());
  expect(back.searchParams.get("state")).toBe("e2e-state");
  expect(back.searchParams.get("iss")).toBeTruthy();

  const token = await page.request.post("/api/oauth/token", {
    form: {
      grant_type: "authorization_code",
      code: back.searchParams.get("code")!,
      client_id: params.get("client_id")!,
      redirect_uri: CALLBACK,
      code_verifier: verifier,
    },
  });
  expect(token.status()).toBe(200);
  const { access_token } = await token.json();
  const pages = await page.request.get("/api/v1/pages", { headers: { Authorization: `Bearer ${access_token}` } });
  expect(pages.status()).toBe(200);
});

test("Cancel returns access_denied, and a bad request never leaves Booklet", async ({ page }) => {
  const { params } = await setup(page.request);
  const email = `e2e-oauth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  await page.request.post("/api/auth/signup", { data: { email, password: PASSWORD } });
  await page.route("https://claude.ai/**", (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "callback" }));

  await page.goto(`/oauth/authorize?${params}`);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForURL(/^https:\/\/claude\.ai\//);
  expect(new URL(page.url()).searchParams.get("error")).toBe("access_denied");
  expect(new URL(page.url()).searchParams.get("code")).toBeNull();

  // An unregistered redirect URI, and a request without PKCE: both stay on
  // Booklet with an explanation. Neither redirects anywhere.
  for (const change of [{ redirect_uri: "https://evil.example/cb" }, { code_challenge_method: "plain" }]) {
    const bad = new URLSearchParams(params);
    for (const [k, v] of Object.entries(change)) bad.set(k, v);
    await page.goto(`/oauth/authorize?${bad}`);
    await expect(page.getByRole("heading", { name: "This app can't be connected" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/oauth/authorize");
  }
});
