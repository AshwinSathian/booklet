import { test, expect, type Page } from "@playwright/test";

// Toolbar, slash-menu and find/replace edits used to replace the textarea's
// value through React state, which wipes the browser's native undo stack —
// the platform undo shortcut did nothing (or undid something older). They now
// go through src/lib/editor/undoable-edit.ts. Runs in Chromium and WebKit
// (see playwright.config.ts): the two engines implement execCommand
// independently.

// Opens the editor with `content` already in the textarea as a restored
// draft, so the content itself is NOT on the undo stack. That matters for
// WebKit: Playwright's headless WebKit build puts every edit since page load
// into one undo group (even two separate typing runs with a click between
// them), so "type the original, edit, undo" lands on an empty textarea there
// no matter what the app does. With a restored draft, the only undoable step
// is the programmatic edit under test, in both engines.
async function openEditorWith(page: Page, content: string) {
  await page.goto("/app");
  const textarea = page.locator("textarea").first();
  await textarea.fill(content);
  // Autosave is debounced; reload only once the draft is really persisted.
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("booklet:draftsDb") ?? ""))
    .toContain(JSON.stringify(content).slice(1, -1));
  await page.reload();
  await expect(textarea).toHaveValue(content);
  await textarea.click();
  return textarea;
}

test.describe("undo after programmatic edits", () => {
  test("Bold on a selected word is undone by the platform undo shortcut", async ({ page }) => {
    const textarea = await openEditorWith(page, "alpha beta gamma");
    await textarea.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(6, 10));

    await page.getByTitle("Bold (wrap in **)").click();
    await expect(textarea).toHaveValue("alpha **beta** gamma");

    await textarea.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(textarea).toHaveValue("alpha beta gamma");
  });

  test("a slash-menu table insertion is undone by the platform undo shortcut", async ({ page }) => {
    const textarea = await openEditorWith(page, "Intro\n");
    await textarea.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(6, 6));

    await page.getByTitle("Insert block (/)").click();
    await page.getByText("Table", { exact: true }).click();
    await expect(textarea).toHaveValue(/^Intro\n+\| Column 1/);

    await textarea.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(textarea).toHaveValue("Intro\n");
  });

  test("replace-all is undone in one step", async ({ page }) => {
    const textarea = await openEditorWith(page, "cat dog cat");
    await page.getByTitle("Find & replace (⌘F)").click();
    await page.getByPlaceholder("Find…").fill("cat");
    await page.getByPlaceholder("Replace with…").fill("bird");
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(textarea).toHaveValue("bird dog bird");

    await textarea.focus();
    await page.keyboard.press("ControlOrMeta+z");
    await expect(textarea).toHaveValue("cat dog cat");
  });

  test("undo removes only the programmatic edit, not the typing before it", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "Playwright WebKit keeps a single undo group — see openEditorWith");
    await page.goto("/app");
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await page.keyboard.type("Intro");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/table");
    await expect(page.getByText("Table", { exact: true })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(textarea).toHaveValue(/^Intro\n+\| Column 1/);

    await page.keyboard.press("ControlOrMeta+z");
    await expect(textarea).toHaveValue("Intro\n/table");
  });
});

test.describe("character counter", () => {
  test("shows the count against the 200,000 limit only above 180,000 characters", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "engine-independent");
    await page.goto("/app");
    const textarea = page.locator("textarea").first();
    await textarea.fill("a".repeat(180_000));
    await expect(page.getByTestId("char-limit-counter")).toHaveCount(0);
    await textarea.fill("a".repeat(180_001));
    await expect(page.getByTestId("char-limit-counter")).toHaveText("180,001 / 200,000 characters");
  });
});
