import { test, expect } from "@playwright/test";

// The axe scan of the editor, with every other page, is in
// accessibility-routes.spec.ts. This file has the checks axe cannot make.

test.describe("editor accessibility", () => {
  test("the slash menu and command palette are keyboard-reachable and labeled", async ({ page }) => {
    await page.goto("/app");
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await page.keyboard.type("/head");
    await expect(page.getByText("Heading 1", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder(/jump to a draft/i)).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

// Task 5.12: pointer targets (WCAG 2.2, 2.5.8) and the toolbar on a phone.
test.describe("editor toolbar", () => {
  test("every toolbar button is at least 24 by 24 CSS pixels", async ({ page }) => {
    await page.goto("/app");
    await page.waitForSelector("textarea");
    const sizes = await page.locator("button[title='Insert block (/)']").locator("xpath=..").locator("button").evaluateAll((buttons) =>
      buttons.map((b) => ({ title: b.getAttribute("title"), ...(({ width, height }) => ({ width, height }))(b.getBoundingClientRect()) })),
    );
    expect(sizes.length).toBeGreaterThan(10);
    expect(sizes.filter((s) => s.width < 24 || s.height < 24)).toEqual([]);
  });

  test("on a phone it scrolls sideways and sits above the text, clear of the on-screen keyboard", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto("/app");
    // An empty draft opens on the Preview tab at this width.
    await page.getByRole("tab", { name: "Write" }).click();
    await page.waitForSelector("textarea");
    const bar = page.locator("button[title='Insert block (/)']").locator("xpath=..");
    const box = await bar.evaluate((el) => ({
      overflowX: getComputedStyle(el).overflowX,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      bottom: el.getBoundingClientRect().bottom,
      pageOverflows: document.documentElement.scrollWidth > window.innerWidth,
    }));
    // Wider than the screen, and it is the bar that scrolls, not the page.
    expect(box.overflowX).toBe("auto");
    expect(box.scrollWidth).toBeGreaterThan(box.clientWidth);
    expect(box.pageOverflows).toBe(false);
    // The keyboard covers the bottom of the screen; the bar is above the text it edits.
    const textTop = await page.locator("textarea").first().evaluate((el) => el.getBoundingClientRect().top);
    expect(box.bottom).toBeLessThanOrEqual(textTop + 1);
    expect(box.bottom).toBeLessThan(664 / 2);

    // The last button can be brought into view by scrolling the bar.
    const last = bar.locator("button").last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await context.close();
  });
});
