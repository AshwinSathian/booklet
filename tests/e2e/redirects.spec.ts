import { expect, test } from "@playwright/test";
import { getDocsTree } from "@/lib/docs";

// /docs replaced three pages. Their addresses, and the fragments people
// linked to on them, still lead to the content.

const MOVES: Array<[string, string]> = [
  ["/api-docs", "/docs/reference/api"],
  ["/integrations", "/docs"],
  ["/mcp-setup", "/docs/guides/mcp"],
  ["/mcp", "/docs/guides/mcp"],
];

for (const [from, to] of MOVES) {
  test(`${from} redirects permanently to ${to}`, async ({ request }) => {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(new URL(res.headers().location, "http://x").pathname).toBe(to);
    expect((await request.get(to)).status()).toBe(200);
  });
}

const FRAGMENTS: Array<[string, RegExp, string]> = [
  ["/api-docs#github-actions", /\/docs\/guides\/github-action$/, "GitHub Action"],
  ["/api-docs#rate-limits", /\/docs\/reference\/limits$/, "Limits"],
  ["/api-docs#webhooks", /\/docs\/guides\/webhooks$/, "Webhooks"],
  ["/integrations#cli", /\/docs\/guides\/cli$/, "CLI"],
];

for (const [from, url, title] of FRAGMENTS) {
  test(`${from} ends on the page that has that section now`, async ({ page }) => {
    await page.goto(from);
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });
}

test("an old fragment that is still a heading on the API page stays there", async ({ page }) => {
  await page.goto("/api-docs#authentication");
  await expect(page).toHaveURL(/\/docs\/reference\/api#authentication$/);
  await expect(page.locator("#authentication")).toBeInViewport();
});

test("llms.txt lists every docs page, and llms-full.txt holds their text", async ({ request }) => {
  const index = await (await request.get("/llms.txt")).text();
  for (const page of getDocsTree().flatMap((s) => s.pages)) expect(index, page.href).toContain(`${page.href}.md`);
  const full = await (await request.get("/llms-full.txt")).text();
  expect(full).toContain("# Quickstart");
  expect(full).toContain("Idempotency-Key");
});
