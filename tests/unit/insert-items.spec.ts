import { test, expect } from "@playwright/test";
import { INSERT_ITEMS, filterInsertItems, normalizeBlockInsertion } from "@/lib/editor/insertItems";
import { CALLOUT_KINDS } from "@/lib/blocks";

test.describe("insert items", () => {
  test("includes one item per callout kind, each producing a > [!kind] snippet", () => {
    for (const kind of CALLOUT_KINDS) {
      const item = INSERT_ITEMS.find((i) => i.id === `callout-${kind}`);
      expect(item).toBeDefined();
      expect(item!.snippet.text).toBe(`> [!${kind}]\n> `);
    }
  });

  test("toggle snippet is a valid :::toggle directive with the Summary placeholder selected", () => {
    const item = INSERT_ITEMS.find((i) => i.id === "toggle");
    expect(item).toBeDefined();
    expect(item!.snippet.text).toBe(":::toggle Summary\n\n:::\n");
    const { text, selectFrom, selectTo } = item!.snippet;
    expect(text.slice(selectFrom, selectTo)).toBe("Summary");
  });

  test("columns snippet places the cursor inside the first column body", () => {
    const item = INSERT_ITEMS.find((i) => i.id === "columns");
    expect(item).toBeDefined();
    expect(item!.snippet.text).toBe(":::columns\n\n---\n\n:::\n");
    expect(item!.snippet.selectFrom).toBe(item!.snippet.selectTo);
    expect(item!.snippet.text.slice(0, item!.snippet.selectFrom)).toBe(":::columns\n");
  });

  test("table snippet selects the 'Column 1' placeholder, matching the toolbar's insertTable behavior", () => {
    const item = INSERT_ITEMS.find((i) => i.id === "table");
    expect(item).toBeDefined();
    const { text, selectFrom, selectTo } = item!.snippet;
    expect(text.slice(selectFrom, selectTo)).toBe("Column 1");
  });

  test("filterInsertItems with an empty query returns every item", () => {
    expect(filterInsertItems("")).toHaveLength(INSERT_ITEMS.length);
  });

  test("filterInsertItems matches by label", () => {
    const results = filterInsertItems("head");
    expect(results.map((i) => i.id)).toEqual(expect.arrayContaining(["h1", "h2", "h3"]));
  });

  test("filterInsertItems matches by keyword even when the label doesn't contain the query", () => {
    const results = filterInsertItems("checkbox");
    expect(results.map((i) => i.id)).toContain("task");
  });

  test("filterInsertItems is case-insensitive", () => {
    expect(filterInsertItems("CALLOUT").length).toBeGreaterThan(0);
  });

  test("every item id is unique", () => {
    const ids = INSERT_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Every INSERT_ITEMS snippet requires its own line to parse as valid
  // Markdown (ATX headings, list/quote markers, and fenced/directive blocks
  // are all only recognized at the start of a line) — see InsertSnippet's
  // `block` docstring for the full reasoning.
  test("every insert item is marked block: true", () => {
    for (const item of INSERT_ITEMS) {
      expect(item.snippet.block, `${item.id} should be block: true`).toBe(true);
    }
  });
});

// Regression coverage for the bug where inserting a block-level snippet
// (divider, callout, table, etc.) via the "+" toolbar button, "/" slash
// menu, or command palette produced garbled Markdown unless the caret
// happened to already be at the start of an empty line — e.g. inserting a
// divider after "Existing text." produced "Existing text.---\n" (a single
// garbled line) instead of "Existing text.\n\n---\n". normalizeBlockInsertion
// is the shared fix (also used by the pre-existing insertTable(), which this
// mirrors) — these four cases match the four cases insertTable's own
// leading/trailing-newline logic already handled before being generalized.
test.describe("normalizeBlockInsertion", () => {
  test("at the very start of an empty document: no extra newlines needed", () => {
    const { insertion, leadingOffset } = normalizeBlockInsertion("", "", "---\n");
    expect(insertion).toBe("---\n");
    expect(leadingOffset).toBe(0);
  });

  test("after existing text on the same line with no trailing newline: needs a blank line before", () => {
    const { insertion, leadingOffset } = normalizeBlockInsertion("Existing text.", "", "---\n");
    expect(insertion).toBe("\n\n---\n");
    expect(leadingOffset).toBe(2);
  });

  test("before existing text with no leading newline: needs a blank line after", () => {
    const { insertion, leadingOffset } = normalizeBlockInsertion("", "more text", "---\n");
    expect(insertion).toBe("---\n\n\n");
    expect(leadingOffset).toBe(0);
  });

  test("already on its own blank line (blank line before and after): no extra newlines needed", () => {
    const { insertion, leadingOffset } = normalizeBlockInsertion("Some paragraph.\n\n", "\n\nMore.", "---\n");
    expect(insertion).toBe("---\n");
    expect(leadingOffset).toBe(0);
  });

  test("mid-sentence on both sides needs blank lines on both sides", () => {
    const { insertion, leadingOffset } = normalizeBlockInsertion("Before.", "After.", "---\n");
    expect(insertion).toBe("\n\n---\n\n\n");
    expect(leadingOffset).toBe(2);
  });
});
