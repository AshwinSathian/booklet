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

async function seedManyDrafts(page: Page, count: number, oldestTitle: string) {
  await page.evaluate(
    ({ count, oldestTitle }) => {
      const raw = localStorage.getItem("booklet:draftsDb");
      const db = raw ? JSON.parse(raw) : { schemaVersion: 2, drafts: {} };
      const base = Date.now();
      for (let i = 0; i < count; i++) {
        // i === count - 1 is the oldest (smallest updatedAt) — listDrafts()
        // sorts recent-first, so this one lands last.
        const title = i === count - 1 ? oldestTitle : `Filler draft ${i}`;
        const id = `seeded-many-${i}`;
        const updatedAt = new Date(base - i * 60_000).toISOString();
        db.drafts[id] = {
          id, v: 2, createdAt: updatedAt, updatedAt, title,
          raw: `# ${title}\n\nSome content.`,
          settings: { spacing: "comfortable", width: "normal", code: "collapse" },
        };
      }
      localStorage.setItem("booklet:draftsDb", JSON.stringify(db));
    },
    { count, oldestTitle },
  );
}

test.describe("command palette", () => {
  // Regression coverage: the Drafts group used to slice to the 8 most
  // recently-edited drafts *before* cmdk's own fuzzy filter ever ran, so
  // typing a query matching an older draft's title returned nothing — the
  // design spec calls for the Drafts group to be fuzzy-searchable across
  // every draft, not just the 8 most recent (that cap is only meant to
  // bound the empty-query "recent drafts" view). Seeds 10 drafts so the
  // target is the 10th-most-recently-edited — well past the old cap — then
  // searches for it by title.
  test("finds and switches to a draft older than the 8 most recently edited", async ({ page }) => {
    await page.goto("/app");
    await seedManyDrafts(page, 10, "Ancient Archived Notes");

    await page.keyboard.press("Control+k");
    await page.keyboard.type("Ancient Archived");
    await expect(page.getByText("Ancient Archived Notes", { exact: true })).toBeVisible();
    await page.getByText("Ancient Archived Notes", { exact: true }).click();

    await expect(page.locator("textarea").first()).toHaveValue(/Ancient Archived Notes/);
  });

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

    // The divider is block-level Markdown (see InsertSnippet.block) — inserting
    // it mid-line must push it onto its own line via a leading blank line,
    // not splice "---\n" directly onto the end of "Existing text.".
    await expect(textarea).toHaveValue("Existing text.\n\n---\n");
  });
});
