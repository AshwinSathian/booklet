import { test, expect } from "@playwright/test";
import { INSERT_ITEMS, filterInsertItems } from "@/lib/editor/insertItems";
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
});
