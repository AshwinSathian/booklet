import { test, expect, type Page } from "@playwright/test";

// Regression coverage for "wikilink autocomplete not firing": detectWikilinkTrigger()
// and wikilinkMatchTitles() in src/components/app/PasteInput.tsx are structurally
// correct (matches exist whenever other drafts do), so the suspected culprit was the
// caret-coordinate positioning math (src/lib/ui/caret.ts) that decides where to
// render the popup — a classic "it's rendering, just off-screen or z-index-buried"
// bug. These tests type `[[` character-by-character against a seeded multi-draft
// fixture and assert the popup is both visible and positioned within the viewport,
// rather than assuming a fix.

async function seedSecondDraft(page: Page, title: string, id = "seeded-other-draft-1") {
  await page.evaluate(
    ({ title, id }) => {
      const raw = localStorage.getItem("booklet:draftsDb");
      const db = raw ? JSON.parse(raw) : { schemaVersion: 2, drafts: {} };
      const now = new Date().toISOString();
      db.drafts[id] = {
        id,
        v: 2,
        createdAt: now,
        updatedAt: now,
        title,
        raw: `# ${title}\n\nSome content.`,
        settings: { spacing: "comfortable", width: "normal", code: "collapse" },
      };
      localStorage.setItem("booklet:draftsDb", JSON.stringify(db));
    },
    { title, id },
  );
}

async function typeCharByChar(page: Page, text: string) {
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: 30 });
  }
}

test.describe("wikilink autocomplete popup", () => {
  test("appears and is fully within the viewport for a normal (unscrolled) trigger", async ({ page }) => {
    await page.goto("/app");
    await seedSecondDraft(page, "Project Roadmap");

    const textarea = page.locator("textarea").first();
    await textarea.click();
    await textarea.fill("Some intro text. ");
    await typeCharByChar(page, "[[Proj");

    const popup = page.getByText("Project Roadmap", { exact: true });
    await expect(popup).toBeVisible();

    const box = await popup.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
  });

  test("stays within the viewport when the trigger is near the bottom of a scrolled textarea", async ({ page }) => {
    await page.goto("/app");
    await seedSecondDraft(page, "Project Roadmap");

    const textarea = page.locator("textarea").first();
    await textarea.click();

    // Enough lines to force the textarea to scroll, so the caret at the end
    // sits near the bottom of the visible viewport — the scenario that
    // reproduces the off-screen popup.
    const lines = Array.from({ length: 60 }, (_, i) => `Line number ${i + 1} of body text.`);
    await textarea.fill(lines.join("\n"));

    await textarea.press("Control+End").catch(() => {});
    await page.keyboard.press("End");
    await typeCharByChar(page, "\n[[Proj");

    const popup = page.getByText("Project Roadmap", { exact: true });
    await expect(popup).toBeVisible();

    const box = await popup.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
    }
  });

  test("stays within the viewport when the trigger is near the right edge on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 800 });
    await page.goto("/app");
    await seedSecondDraft(page, "Project Roadmap");

    // Below the `lg` breakpoint the shell shows one pane at a time via a
    // Write/Preview tab bar; a fresh/empty draft defaults to Preview, which
    // hides the textarea entirely.
    const writeTab = page.getByRole("tab", { name: "Write" });
    if (await writeTab.isVisible().catch(() => false)) {
      await writeTab.click();
    }

    const textarea = page.locator("textarea").first();
    await textarea.click();
    // A single long unbroken token near the textarea's own wrap width pushes
    // the caret close to the right edge of a narrow viewport.
    await textarea.fill("x".repeat(60));
    await textarea.press("End");
    await typeCharByChar(page, "[[Proj");

    const popup = page.getByText("Project Roadmap", { exact: true });
    await expect(popup).toBeVisible();

    const box = await popup.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
  });
});
