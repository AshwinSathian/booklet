import { expect, test } from "@playwright/test";

// The homepage shows the product working: a document typed on the left, the
// page it becomes on the right.

test("the product shot is in the first screen and plays through to a published page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const shot = page.getByTestId("product-shot");
  const box = (await shot.boundingBox())!;
  // At least 300px of it shows without scrolling.
  expect(box.y + 300).toBeLessThan(900);
  await expect(shot).toHaveAttribute("data-state", "done", { timeout: 20_000 });
  await expect(shot.getByTestId("shot-url")).toContainText("/p/checkout-incident");
  await expect(shot.getByTestId("shot-page")).toContainText("Root cause");
});

test("the playback can be paused and resumed", async ({ page }) => {
  await page.goto("/");
  const shot = page.getByTestId("product-shot");
  // It starts when enough of it is on screen.
  await shot.scrollIntoViewIfNeeded();
  await expect(shot).toHaveAttribute("data-state", "playing");
  await shot.getByRole("button", { name: "Pause" }).click();
  const frozen = await shot.locator("pre").innerText();
  await page.waitForTimeout(900);
  expect(await shot.locator("pre").innerText()).toBe(frozen);
  await shot.getByRole("button", { name: "Play" }).click();
  await expect(shot).toHaveAttribute("data-state", "done", { timeout: 20_000 });
});

test("with reduced motion the finished page is there at once and nothing plays", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  // The theme toggle renders after hydration: past this point a player would have started.
  await expect(page.getByRole("button", { name: /Switch to (light|dark) mode/ })).toBeVisible();
  const shot = page.getByTestId("product-shot");
  await expect(shot).toHaveAttribute("data-state", "done");
  await expect(shot.getByTestId("shot-url")).toBeVisible();
  await expect(shot.getByRole("button", { name: /pause|play|replay/i })).toHaveCount(0);
  await shot.getByRole("tab", { name: "ADR" }).click();
  await expect(shot).toHaveAttribute("data-state", "done");
  await expect(shot.getByTestId("shot-page")).toContainText("Decision");
  await context.close();
});

test("without JavaScript the copy, the finished shot and the questions are all there", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Publish it as a page");
  await expect(page.getByTestId("shot-page")).toContainText("Root cause");
  await expect(page.getByTestId("shot-url")).toBeVisible();
  await page.locator("details summary").first().click();
  await expect(page.locator("details[open]")).toHaveCount(1);
  await context.close();
});

test("the example tabs work from the keyboard and switch the document", async ({ page }) => {
  await page.goto("/");
  const shot = page.getByTestId("product-shot");
  await shot.getByRole("tab", { name: "Runbook" }).focus();
  await page.keyboard.press("Enter");
  await expect(shot.getByRole("tab", { name: "Runbook" })).toHaveAttribute("aria-selected", "true");
  await expect(shot).toHaveAttribute("data-state", "done", { timeout: 20_000 });
  await expect(shot.getByTestId("shot-page")).toContainText("Database failover");
});

test("nothing inside an example document can take focus", async ({ page }) => {
  await page.goto("/");
  const focusable = await page.evaluate(
    () => [...document.querySelectorAll("[inert] a, [inert] button, [inert] [tabindex]")].filter((el) => (el as HTMLElement).matches(":focus-within, :not([inert] *)")).length,
  );
  expect(focusable).toBe(0);
  // The page pane is inert, so the copy and expand buttons of its code blocks are skipped by Tab.
  await expect(page.getByTestId("shot-page")).toHaveAttribute("inert", "");
});

test("the five ways to publish are tabs, each with a snippet that can be copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("tab", { name: "CLI" }).click();
  const panel = page.locator("#way-panel");
  await expect(panel).toContainText("npx booklet-cli publish");
  await panel.getByRole("button", { name: "Copy" }).click();
  await expect(panel.getByRole("button")).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("npx booklet-cli publish");
});

test("the page is under 7,000px tall on a desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(7000);
});
