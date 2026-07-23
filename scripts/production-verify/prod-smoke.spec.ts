import { test, expect } from "@playwright/test";
import { MongoClient } from "mongodb";
import { SignJWT } from "jose";

// This app keys every collection's _id with an app-generated string, never
// Mongo's default ObjectId — see src/lib/db/index.ts's Doc types.
type StringIdDoc = { _id: string; [key: string]: unknown };

/**
 * Manual, opt-in production verification — NOT part of the default test
 * suite (deliberately kept outside tests/e2e/ so playwright.config.ts's
 * testDir glob never picks it up automatically). Run explicitly after a
 * production deploy:
 *
 *   TEST_BASE_URL=https://booklet.ashwinsathian.com \
 *   MONGODB_URI="mongodb://127.0.0.1:27017/readable?directConnection=true" \
 *   CLAIM_TOKEN_SECRET=<same value as .env.production.local> \
 *   npx playwright test scripts/production-verify/prod-smoke.spec.ts --config=playwright.config.ts
 *
 * Every account/page/session this creates is tagged with an
 * "e2e-verify-<timestamp>" email/title prefix and deleted at the end
 * (afterAll), scoped precisely to what this run created — never a broad
 * collection wipe. Existing production data (real anonymous pages, real
 * accounts) is never touched.
 */

const BASE = process.env.TEST_BASE_URL ?? "https://booklet.ashwinsathian.com";
const API_BASE = process.env.TEST_API_BASE_URL ?? "https://booklet-api.ashwinsathian.com";
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/readable?directConnection=true";
const RUN_ID = Date.now();
const EMAIL = `e2e-verify-${RUN_ID}@example.test`;
const PASSWORD = "prod-verify-correct-horse-battery";
const CLAIM_EMAIL = `e2e-verify-claim-${RUN_ID}@example.test`;
const CLAIM_USER_ID = `e2e_verify_claim_${RUN_ID}`;

let createdPageIds: string[] = [];

test.describe.configure({ mode: "serial" });

test.describe("Production verification — core routes", () => {
  for (const path of ["/", "/explore", "/pricing", "/integrations", "/api-docs", "/mcp-setup", "/sign-in", "/sign-up"]) {
    test(`${path} loads without error`, async ({ page }) => {
      const res = await page.goto(`${BASE}${path}`);
      expect(res?.status()).toBeLessThan(500);
      await expect(page.locator("body")).not.toContainText("Application error");
    });
  }
});

test.describe("Production verification — booklet-api.ashwinsathian.com host restriction", () => {
  test("non-API path 404s on the API hostname", async ({ request }) => {
    const res = await request.get(API_BASE, { maxRedirects: 0 });
    expect(res.status()).toBe(404);
  });

  test("API path without a key returns 401 on the API hostname", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/v1/pages`);
    expect(res.status()).toBe(401);
  });

  test("main hostname still serves the UI", async ({ request }) => {
    const res = await request.get(BASE);
    expect(res.status()).toBe(200);
  });
});

test.describe("Production verification — signup, publish, session lifecycle", () => {
  test("sign up, publish via the editor, reach my-pages, log out, log back in", async ({ page }) => {
    await page.goto(`${BASE}/sign-up`);
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/app/, { timeout: 15000 });

    // Publish a real page through the actual editor UI, not the API directly.
    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await textarea.click();
    await textarea.fill(`# e2e-verify-${RUN_ID}\n\nProduction verification test content.`);

    const publishBtn = page.locator("button").filter({ hasText: /publish/i }).first();
    await publishBtn.click();

    // Signed-in publishes surface a "set a custom URL before sharing" panel
    // immediately after success (anonymous publishes don't — they just get
    // a direct share link) — wait for that success signal instead of an
    // href/value pattern that only applies to the anonymous flow.
    await expect(page.getByText(/your page/i).or(page.getByText(/set a custom url/i)).first()).toBeVisible({
      timeout: 15000,
    });
    // Best-effort dismiss so it doesn't block later interactions.
    await page.getByRole("button", { name: /^close$|^×$|^x$/i }).first().click({ timeout: 2000 }).catch(() => {});

    await page.goto(`${BASE}/my-pages`);
    await expect(page).toHaveURL(/\/my-pages/);
    await expect(page.locator("body")).toContainText(`e2e-verify-${RUN_ID}`, { timeout: 10000 });

    const logoutRes = await page.request.post(`${BASE}/api/auth/logout`);
    expect(logoutRes.status()).toBe(200);
    await page.goto(`${BASE}/my-pages`);
    await expect(page).toHaveURL(/sign-in/);

    await page.goto(`${BASE}/sign-in`);
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/app/, { timeout: 15000 });
  });

  test("cross-origin login is rejected (CSRF check)", async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      headers: { origin: "https://evil.example" },
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(res.status()).toBe(403);
  });

  test("admin is forbidden without an allowlisted IP", async ({ request }) => {
    const res = await request.get(`${BASE}/admin`, { maxRedirects: 0 });
    expect(res.status()).toBe(403);
  });
});

test.describe("Production verification — v1 API via booklet-api.ashwinsathian.com", () => {
  let apiKey: string;
  let apiPageId: string;

  test("create an API key, then publish/get/list/delete a page through the API hostname", async ({ request }) => {
    const loginRes = await request.post(`${BASE}/api/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(loginRes.ok()).toBe(true);

    const keyRes = await request.post(`${BASE}/api/v1/keys`, { data: { label: `e2e-verify-${RUN_ID}` } });
    expect(keyRes.ok()).toBe(true);
    apiKey = (await keyRes.json()).key;
    expect(apiKey).toMatch(/^bklt_/);

    const publishRes = await request.post(`${API_BASE}/api/v1/publish`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      data: { raw: `# API verify ${RUN_ID}` },
    });
    expect(publishRes.status()).toBe(201);
    apiPageId = (await publishRes.json()).id;
    createdPageIds.push(apiPageId);

    const getRes = await request.get(`${API_BASE}/api/v1/pages/${apiPageId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(getRes.status()).toBe(200);

    const listRes = await request.get(`${API_BASE}/api/v1/pages`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(listRes.status()).toBe(200);
    const { pages } = await listRes.json();
    expect(pages.some((p: { id: string }) => p.id === apiPageId)).toBe(true);

    const deleteRes = await request.delete(`${API_BASE}/api/v1/pages/${apiPageId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(deleteRes.status()).toBe(200);
    createdPageIds = createdPageIds.filter((id) => id !== apiPageId);
  });
});

test.describe("Production verification — migrated-user claim flow", () => {
  test.beforeAll(async () => {
    const secret = process.env.CLAIM_TOKEN_SECRET;
    if (!secret) test.skip(true, "CLAIM_TOKEN_SECRET not provided — skipping claim-flow verification");
  });

  test("insert a migrated-style user, claim via /claim, then log in with the new password", async ({ page, request }) => {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    await client.db("readable").collection<StringIdDoc>("users").insertOne({
      _id: CLAIM_USER_ID,
      email: CLAIM_EMAIL,
      password_hash: null,
      display_name: "E2E Verify Claim",
      plan: "free",
      created_at: new Date().toISOString(),
    });
    await client.close();

    const secret = new TextEncoder().encode(process.env.CLAIM_TOKEN_SECRET!);
    const token = await new SignJWT({ userId: CLAIM_USER_ID })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30d")
      .setIssuedAt()
      .sign(secret);

    await page.goto(`${BASE}/claim?token=${token}`);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirm").fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/my-pages/, { timeout: 15000 });

    await page.request.post(`${BASE}/api/auth/logout`);

    const loginRes = await request.post(`${BASE}/api/auth/login`, {
      data: { email: CLAIM_EMAIL, password: PASSWORD },
    });
    expect(loginRes.ok()).toBe(true);

    // Replaying the same claim token must fail now that a password is set.
    const replayRes = await request.post(`${BASE}/api/auth/claim`, {
      data: { token, password: "a-different-password-123" },
    });
    expect(replayRes.status()).toBe(409);
  });
});

test.afterAll(async () => {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db("readable");

  const users = await db
    .collection<StringIdDoc>("users")
    .find({ email: { $in: [EMAIL, CLAIM_EMAIL] } })
    .toArray();
  const userIds = users.map((u) => u._id);

  // Any page still owned by a test user at this point (e.g. the
  // signed-in-editor publish, which has no scraped id) needs the same
  // docs/page_versions cleanup as an explicitly-tracked createdPageIds
  // entry — look them up by owner rather than relying solely on scraping.
  const ownedPages =
    userIds.length > 0
      ? await db.collection<StringIdDoc>("pages").find({ user_id: { $in: userIds } }).toArray()
      : [];
  const allPageIds = [...new Set([...createdPageIds, ...ownedPages.map((p) => p._id)])];

  if (allPageIds.length > 0) {
    await db.collection("page_versions").deleteMany({ page_id: { $in: allPageIds } });
    await db.collection<StringIdDoc>("docs").deleteMany({ _id: { $in: allPageIds } });
    await db.collection<StringIdDoc>("pages").deleteMany({ _id: { $in: allPageIds } });
  }
  if (userIds.length > 0) {
    await db.collection("sessions").deleteMany({ user_id: { $in: userIds } });
    await db.collection("api_keys").deleteMany({ user_id: { $in: userIds } });
  }
  await db.collection<StringIdDoc>("users").deleteMany({ _id: { $in: [...userIds, CLAIM_USER_ID] } });
  await db.collection("users").deleteMany({ email: { $in: [EMAIL, CLAIM_EMAIL] } });

  console.log(
    `[prod-smoke cleanup] removed ${userIds.length + 1} test user(s), ${allPageIds.length} test page(s)`,
  );
  await client.close();
});
