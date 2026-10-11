import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { getDocsTree } from "@/lib/docs";

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const pages = getDocsTree().flatMap((s) => s.pages);

test("every docs page renders its title, and passes axe in both themes", async ({ browser }) => {
  test.setTimeout(300_000);
  for (const theme of ["light", "dark"] as const) {
    const context = await browser.newContext({ colorScheme: theme });
    await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
    const page = await context.newPage();
    for (const doc of pages) {
      const response = await page.goto(doc.href);
      expect.soft(response!.status(), doc.href).toBe(200);
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText(doc.title);
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
      expect.soft(violations.map((v) => `${v.id}: ${v.nodes[0].target.join(" ")}`), `${doc.href} (${theme})`).toEqual([]);
    }
    await context.close();
  }
});

test("a docs page is also served as Markdown, not indexed", async ({ request }) => {
  const res = await request.get("/docs/quickstart.md");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/markdown");
  expect(res.headers()["x-robots-tag"]).toBe("noindex");
  expect(await res.text()).toContain("title: Quickstart");
  expect((await request.get("/docs/nope.md")).status()).toBe(404);
});

test("an unknown docs page is a 404, and so is a path that tries to leave the docs folder", async ({ request }) => {
  expect((await request.get("/docs/nope")).status()).toBe(404);
  expect((await request.get("/docs/guides/..%2F..%2Fpackage")).status()).toBe(404);
  expect((await request.get("/docs/raw/..%2F..%2F..%2Fpackage.json")).status()).toBe(404);
});

test("search opens with the slash key and takes you to a page", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeVisible();
  await page.getByRole("heading", { level: 1 }).click();
  await page.keyboard.press("/");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  const input = page.getByPlaceholder("Search the docs");
  await expect(input).toBeFocused();
  await input.fill("REST API safe retries");
  await expect(page.getByRole("option").first()).toContainText("REST API: Safe retries");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/reference\/api#safe-retries$/);
  // One dialog, and it is gone: nothing is left covering the page.
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("on a phone the docs menu and the page's contents are reachable without the sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/guides/cli");
  await page.getByText("Docs menu").click();
  await expect(page.getByRole("navigation", { name: "Docs menu" }).getByRole("link", { name: "Webhooks" })).toBeVisible();
  await page.locator("summary", { hasText: "On this page" }).click();
  await expect(page.getByRole("link", { name: "Update a page in place" })).toBeVisible();
});

test("the MCP guide's client picker fills a pasted key into the config", async ({ page }) => {
  await page.goto("/docs/guides/mcp");
  await page.getByRole("tab", { name: /Cursor/ }).click();
  await page.getByLabel(/Paste the key/).fill("bklt_pasted_for_test");
  await expect(page.locator("pre").filter({ hasText: "bklt_pasted_for_test" }).first()).toBeVisible();
});

test("without JavaScript a reference page still shows its headings, tables and code", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/docs/reference/api");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("REST API");
  await expect(page.getByRole("heading", { name: "Safe retries" })).toBeVisible();
  await expect(page.locator("pre").filter({ hasText: "Idempotency-Key" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Docs", exact: true })).toContainText("Quickstart");
  await context.close();
});
