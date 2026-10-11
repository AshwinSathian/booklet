import { test, expect } from "@playwright/test";

// The Content-Security-Policy lets a script run only with the request's
// nonce (src/middleware.ts). No 'unsafe-inline' for scripts.

const scriptSrc = (csp: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src")) ?? "";

test("script-src carries a fresh nonce per request and no 'unsafe-inline'", async ({ request }) => {
  const [a, b] = await Promise.all([request.get("/"), request.get("/")]);
  const [first, second] = [scriptSrc(a.headers()["content-security-policy"] ?? ""), scriptSrc(b.headers()["content-security-policy"] ?? "")];
  expect(first).toMatch(/'nonce-[A-Za-z0-9+/=]{20,}'/);
  expect(first).toContain("'strict-dynamic'");
  expect(first).not.toContain("'unsafe-inline'");
  expect(first).not.toContain("'unsafe-eval'");
  expect(first).not.toBe(second);
});

test("the page's own scripts run, and an injected inline script does not", async ({ page }) => {
  const blocked: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) blocked.push(m.text());
  });
  await page.goto("/pricing");
  // Hydrated: the theme toggle only renders its button after hydration.
  await expect(page.getByRole("button", { name: /theme|mode/i }).first()).toBeVisible();
  expect(blocked).toEqual([]);

  // What a markup injection would look like: an element with a handler
  // attribute. No nonce can cover that, whoever adds it.
  const ran = await page.evaluate(() => {
    const holder = document.createElement("div");
    holder.innerHTML = '<img src="x" onerror="window.__injected = true">';
    document.body.appendChild(holder);
    return new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(Boolean((window as unknown as { __injected?: boolean }).__injected)), 300),
    );
  });
  expect(ran).toBe(false);
});

test("an embed page may be framed from anywhere; other pages may not be framed", async ({ request }) => {
  const published = await request.post("/api/publish", { data: { raw: "# Framed\n\nBody." } });
  const { id } = (await published.json()) as { id: string };
  expect((await request.get(`/p/${id}/embed`)).headers()["content-security-policy"]).toContain("frame-ancestors *");
  expect((await request.get(`/p/${id}`)).headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
