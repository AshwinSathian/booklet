import { test, expect } from "@playwright/test";
import {
  backlinksForTitle,
  buildWikilinkIndexFromDrafts,
  isTitleResolved,
  resolvedDraftId,
} from "@/lib/wikilinks";
import { normalizeTitleKey } from "@/lib/wikilinks/resolve";
import type { DraftDoc } from "@/lib/drafts/types";
import { DEFAULT_SETTINGS } from "@/lib/blocks";

// Milestone 1 of PLAN-obsidian-parity.md: the private backlink/graph index
// over a user's own local drafts. `buildWikilinkIndexFromDrafts` is the pure
// core (see its own doc comment) so these tests use a plain fixture array
// instead of needing a browser/localStorage environment.

function draft(overrides: Partial<DraftDoc> & { id: string; title: string; raw: string }): DraftDoc {
  const now = "2026-07-28T00:00:00.000Z";
  return {
    v: 2,
    createdAt: now,
    updatedAt: now,
    settings: DEFAULT_SETTINGS,
    ...overrides,
  };
}

test.describe("normalizeTitleKey", () => {
  test("is case-insensitive and trims whitespace", () => {
    expect(normalizeTitleKey("  My Draft  ")).toBe(normalizeTitleKey("MY DRAFT"));
    expect(normalizeTitleKey("My Draft")).toBe("my draft");
  });
});

test.describe("buildWikilinkIndexFromDrafts", () => {
  test("a draft referencing another by title produces a resolved backlink", () => {
    const a = draft({ id: "a", title: "Draft A", raw: "See [[Draft B]] for context." });
    const b = draft({ id: "b", title: "Draft B", raw: "No links here." });

    const index = buildWikilinkIndexFromDrafts([a, b]);

    expect(isTitleResolved(index, "Draft B")).toBe(true);
    expect(resolvedDraftId(index, "draft b")).toBe("b"); // case-insensitive
    expect(backlinksForTitle(index, "Draft B")).toEqual([{ id: "a", title: "Draft A" }]);
    expect(backlinksForTitle(index, "Draft A")).toEqual([]);
    expect(index.edges).toEqual([{ source: "a", target: "b" }]);
  });

  test("a reference to a title with no matching draft is unresolved and has no edge", () => {
    const a = draft({ id: "a", title: "Draft A", raw: "See [[Nonexistent]]." });
    const index = buildWikilinkIndexFromDrafts([a]);

    expect(isTitleResolved(index, "Nonexistent")).toBe(false);
    expect(resolvedDraftId(index, "Nonexistent")).toBeNull();
    expect(index.edges).toEqual([]);
  });

  test("a self-reference is ignored (no backlink, no edge)", () => {
    const a = draft({ id: "a", title: "Draft A", raw: "Linking to [[Draft A]] itself." });
    const index = buildWikilinkIndexFromDrafts([a]);

    expect(backlinksForTitle(index, "Draft A")).toEqual([]);
    expect(index.edges).toEqual([]);
  });

  test("duplicate references from the same draft produce one backlink entry and one edge", () => {
    const a = draft({ id: "a", title: "Draft A", raw: "[[Draft B]] and [[Draft B]] again." });
    const b = draft({ id: "b", title: "Draft B", raw: "" });
    const index = buildWikilinkIndexFromDrafts([a, b]);

    expect(backlinksForTitle(index, "Draft B")).toEqual([{ id: "a", title: "Draft A" }]);
    expect(index.edges).toEqual([{ source: "a", target: "b" }]);
  });

  test("multiple drafts referencing the same target all appear as separate backlinks", () => {
    const a = draft({ id: "a", title: "Draft A", raw: "[[Shared]]" });
    const b = draft({ id: "b", title: "Draft B", raw: "[[Shared]]" });
    const shared = draft({ id: "s", title: "Shared", raw: "" });
    const index = buildWikilinkIndexFromDrafts([a, b, shared]);

    const backlinks = backlinksForTitle(index, "Shared");
    expect(backlinks.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  test("an empty vault produces an empty index", () => {
    const index = buildWikilinkIndexFromDrafts([]);
    expect(index.edges).toEqual([]);
    expect(isTitleResolved(index, "Anything")).toBe(false);
  });
});
