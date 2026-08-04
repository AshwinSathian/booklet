import { test, expect, type Page } from "@playwright/test";

async function seedSecondDraft(page: Page, title: string, id = "seeded-palette-draft-1") {
  await page.evaluate(
    ({ title, id }) => {
      const raw = localStorage.getItem("booklet:draftsDb");
      const db = raw ? JSON.parse(raw) : { schemaVersion: 2, drafts: {} };
      const now = new Date().toISOString();
      db.drafts[id] = {
        id, v: 2, createdAt: now, updatedAt: now, title,
        raw: `# ${title}\n\nSome content.`,
        settings: { spacing: "comfortable", width: "normal", code: "collapse" },
      };
      localStorage.setItem("booklet:draftsDb", JSON.stringify(db));
    },
    { title, id },
  );
}

test.describe("command palette", () => {
  test("lists and switches to another draft by fuzzy title match", async ({ page }) => {
    await page.goto("/app");
    await seedSecondDraft(page, "Quarterly Roadmap");

    await page.keyboard.press("Control+k");
    await page.keyboard.type("Roadmap");
    await expect(page.getByText("Quarterly Roadmap", { exact: true })).toBeVisible();
    await page.getByText("Quarterly Roadmap", { exact: true }).click();

    await expect(page.locator("textarea").first()).toHaveValue(/Quarterly Roadmap/);
  });

  test("runs the 'New draft' action and closes the palette", async ({ page }) => {
    await page.goto("/app");
    await page.keyboard.press("Control+k");
    await page.getByText("New draft", { exact: true }).click();
    await expect(page.getByPlaceholder(/jump to a draft/i)).not.toBeVisible();
  });

  test("Insert group inserts a block at the editor's last cursor position", async ({ page }) => {
    await page.goto("/app");
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await textarea.fill("Existing text.");
    await textarea.press("End");

    await page.keyboard.press("Control+k");
    await page.keyboard.type("Divider");
    await page.getByText("Divider", { exact: true }).click();

    await expect(textarea).toHaveValue("Existing text.---\n");
  });
});
