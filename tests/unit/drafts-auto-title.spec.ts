import { test, expect } from "@playwright/test";
import { createDraft, updateDraft, getDraft } from "@/lib/drafts/store";
import { DRAFT_DOC } from "@/lib/drafts/constants";

// Regression coverage for "draft titles are permanently Untitled": titles
// used to be set only via an explicit patch.title from the rename UI, never
// derived from typed content — so every draft stayed "Untitled" forever
// unless the user manually renamed it, which in turn broke title-based
// wikilink resolution and the graph view (see src/lib/doc-title.ts and
// src/lib/wikilinks/index.ts). Fixed by deriving a title from the first
// H1/H2 heading whenever content changes and the title is still the
// untouched default.
//
// store.ts gates all persistence behind `typeof window !== "undefined"` /
// `window.localStorage` — this Node-based test runner has no DOM, so a
// minimal in-memory stand-in is enough to exercise the real read/write code
// paths (same idea as svg-sanitize.spec.ts's jsdom stub, just narrower — no
// DOM parsing needed here).
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

test.beforeEach(() => {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: new MemoryStorage(),
  };
});

test.describe("draft auto-title derivation", () => {
  test("a fresh empty draft stays 'Untitled'", () => {
    const draft = createDraft({ raw: "" });
    expect(draft.title).toBe(DRAFT_DOC.defaultTitle);
  });

  test("typing content with a heading auto-populates the title on save", () => {
    const draft = createDraft({ raw: "" });
    expect(draft.title).toBe("Untitled");

    const saved = updateDraft(draft.id, { raw: "# My Great Post\n\nBody text." });
    expect(saved?.title).toBe("My Great Post");
    expect(getDraft(draft.id)?.title).toBe("My Great Post");
  });

  test("an H2 is used when there's no H1", () => {
    const draft = createDraft({ raw: "" });
    const saved = updateDraft(draft.id, { raw: "## Section Heading\n\nBody." });
    expect(saved?.title).toBe("Section Heading");
  });

  test("content with no heading leaves the title as 'Untitled'", () => {
    const draft = createDraft({ raw: "" });
    const saved = updateDraft(draft.id, { raw: "Just a paragraph, no heading." });
    expect(saved?.title).toBe(DRAFT_DOC.defaultTitle);
  });

  test("a manual rename is never overwritten by a later content change", () => {
    const draft = createDraft({ raw: "# First Title" });
    expect(draft.title).toBe("First Title"); // auto-derived at creation

    const renamed = updateDraft(draft.id, { title: "My Custom Name" });
    expect(renamed?.title).toBe("My Custom Name");

    // Further content edits (even ones with a new heading) must not
    // clobber the manual rename.
    const afterEdit = updateDraft(draft.id, { raw: "# A Totally Different Heading" });
    expect(afterEdit?.title).toBe("My Custom Name");
  });

  test("an explicit title patch in the same call wins over the derived one", () => {
    const draft = createDraft({ raw: "" });
    const saved = updateDraft(draft.id, {
      raw: "# Derived Title",
      title: "Explicit Title",
    });
    expect(saved?.title).toBe("Explicit Title");
  });

  test("createDraft derives a title immediately from initial content (e.g. templates)", () => {
    const draft = createDraft({ raw: "# Incident Report Template\n\nDetails here." });
    expect(draft.title).toBe("Incident Report Template");
  });

  test("createDraft honors an explicit initial title over derivation", () => {
    const draft = createDraft({ raw: "# Heading", title: "Custom" });
    expect(draft.title).toBe("Custom");
  });
});
