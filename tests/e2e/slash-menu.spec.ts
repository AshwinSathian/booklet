import { test, expect } from "@playwright/test";

test.describe("slash-insert menu", () => {
  test("opens on '/' at the start of a line and inserts a callout", async ({ page }) => {
    await page.goto("/app");
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await textarea.fill("Intro paragraph.\n");
    await page.keyboard.type("/warn");

    await expect(page.getByText("Callout: Warning", { exact: true })).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(textarea).toHaveValue(/Intro paragraph\.\n> \[!warning\]\n> $/);
  });

  test("does not open mid-word", async ({ page }) => {
    await page.goto("/app");
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await textarea.fill("60km/h");

    await expect(page.getByText("Divider", { exact: true })).not.toBeVisible();
  });

  test("closes on Escape without inserting", async ({ page }) => {
    await page.goto("/app");
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await page.keyboard.type("/tab");
    await expect(page.getByText("Table", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Table", { exact: true })).not.toBeVisible();
    await expect(textarea).toHaveValue("/tab");
  });

  test("the toolbar Insert button opens the menu anchored under the button", async ({ page }) => {
    await page.goto("/app");
    await page.locator("textarea").first().click();
    await page.getByTitle("Insert block (/)").click();
    await expect(page.getByText("Divider", { exact: true })).toBeVisible();
  });
});
