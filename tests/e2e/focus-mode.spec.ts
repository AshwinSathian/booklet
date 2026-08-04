import { test, expect } from "@playwright/test";

// Regression coverage for a bug where Focus Mode's preview pane didn't
// actually hide at desktop widths (>=1024px / Tailwind's `lg:` breakpoint)
// due to a class-cascade conflict in AppShell.tsx: the pane's `hidden` class
// (applied only when focusMode is true) was being overridden by a `lg:flex`
// utility from the non-focus-mode branch of the same conditional class list.
// This test loads the app at a desktop viewport, enters Focus Mode, and
// asserts the preview pane (identified by its "Preview" pane-label span in
// PreviewPane.tsx) is not visible — so a future edit to AppShell.tsx's
// conditional classes that reintroduces the cascade conflict fails CI
// instead of requiring another manual review to catch.
test.describe("focus mode", () => {
  test("hides the preview pane at desktop width", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/app");
    await page.waitForSelector("textarea");

    // Scoped to <span> specifically: AppShell's mobile tab bar (hidden via
    // `lg:hidden` CSS, but still present in the DOM at this desktop
    // viewport) has its own "Preview" tab button with the same accessible
    // text, which would otherwise collide with a plain getByText lookup.
    const previewLabel = page.locator("span").filter({ hasText: /^Preview$/ });
    await expect(previewLabel).toBeVisible();

    await page.keyboard.press("Control+.");

    await expect(previewLabel).toBeHidden();

    // Exiting Focus Mode brings it back — confirms the assertion above is
    // actually observing the focus-mode toggle, not some unrelated state.
    await page.keyboard.press("Control+.");
    await expect(previewLabel).toBeVisible();
  });
});
