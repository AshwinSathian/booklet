import { test, expect } from "@playwright/test";

// Phase 1 removals, checked against a running server: the Clerk claim page
// is gone, and no page loads Google
// Analytics or is allowed to by the CSP.

const GA_HOSTS = /googletagmanager\.com|google-analytics\.com/;

test("/claim returns 404", async ({ request }) => {
  expect((await request.get("/claim")).status()).toBe(404);
});

test("/, /app and a share page make no Google Analytics requests", async ({ page }) => {
  const published = await page.request.post("/api/publish", { data: { raw: "# No trackers\n\nBody." } });
  expect(published.ok()).toBe(true);
  const { id } = (await published.json()) as { id: string };

  const gaRequests: string[] = [];
  page.on("request", (r) => {
    if (GA_HOSTS.test(r.url())) gaRequests.push(r.url());
  });

  for (const path of ["/", "/app", `/p/${id}`]) {
    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect(res?.headers()["content-security-policy"] ?? "", path).not.toMatch(GA_HOSTS);
    expect(await page.content(), path).not.toMatch(GA_HOSTS);
  }
  expect(gaRequests).toEqual([]);
});
