import { expect, test } from "@playwright/test";

// Every marketing and docs page has the one site header and footer, one h1,
// and does not scroll sideways on a phone.

const PAGES = [
  "/",
  "/pricing",
  "/about",
  "/trust",
  "/privacy",
  "/terms",
  "/changelog",
  "/templates",
  "/templates/incident-report",
  "/explore",
  "/tags",
  "/report",
  "/docs",
  "/docs/quickstart",
  "/docs/guides/mcp",
  "/docs/reference/api",
  "/docs/reference/cli",
  "/docs/recipes/adr-log",
  "/this-route-does-not-exist",
];

for (const route of PAGES) {
  test(`${route} has the site header and footer, and one h1`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("header[data-site-header]")).toHaveCount(1);
    await expect(page.locator("footer[data-site-footer]")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator("main#main")).toHaveCount(1);
  });

  test(`${route} does not scroll sideways at 390px`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("the first Tab stop is a skip link to the main content", async ({ page }) => {
  await page.goto("/pricing");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toHaveAttribute("href", "#main");
});

test("the header marks the current section", async ({ page }) => {
  await page.goto("/docs/quickstart");
  await expect(page.getByRole("navigation", { name: "Site", exact: true }).getByRole("link", { name: "Docs" })).toHaveAttribute("aria-current", "page");
});

test("on a phone the menu opens as a dialog, holds the links and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  for (const name of ["Docs", "Templates", "Changelog", "Pricing"]) await expect(menu.getByRole("link", { name, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("explore and the tag pages are not indexed and are not linked from the footer", async ({ page }) => {
  for (const route of ["/explore", "/tags"]) {
    await page.goto(route);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  }
  await expect(page.getByRole("contentinfo").getByRole("link", { name: /explore|tags/i })).toHaveCount(0);
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/explore");
  expect(sitemap).toContain("/docs/quickstart");
});

test("a published page keeps its reading width when it has a table of contents", async ({ page }) => {
  const raw = `# Width check\n\n${"A sentence long enough to fill the line and wrap onto the next one. ".repeat(6)}\n\n## One\n\nText.\n\n## Two\n\nText.\n\n## Three\n\n| Time | Event |\n| --- | --- |\n| 14:32 | Alert triggered: checkout error rate above the five percent threshold |\n`;
  const published = await page.request.post("/api/publish", { data: { raw } });
  expect(published.ok()).toBe(true);
  const { id } = (await published.json()) as { id: string };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/p/${id}`);
  await expect(page.getByText("On this page")).toBeVisible();
  // 48rem of reading column, less nothing: the contents sit beside it, not inside it.
  expect((await page.locator("main p").first().boundingBox())!.width).toBeGreaterThan(700);
  // The table fits the column, so it has nothing to scroll.
  expect(await page.locator("main table").evaluate((t) => t.parentElement!.scrollWidth <= t.parentElement!.clientWidth)).toBe(true);
});
