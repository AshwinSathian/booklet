import { test, expect } from "@playwright/test";
import { buildToc } from "@/lib/toc";
import type { Block } from "@/lib/blocks";

// Phase 1 of PLAN-rich-markdown-blocks.md generalized buildToc()'s container
// recursion (previously hardcoded to `quote` only) so future container block
// kinds (callout, toggle, columns) don't silently drop their nested headings
// from the sidebar TOC. This file is the regression guard for `quote` — its
// output must stay byte-identical to before the refactor.

function heading(level: 1 | 2 | 3, text: string): Block {
  return { t: "heading", level, inl: [{ t: "text", v: text }] };
}

test.describe("buildToc — quote recursion (regression)", () => {
  test("top-level headings are collected in order", () => {
    const blocks: Block[] = [heading(1, "Intro"), heading(2, "Details")];
    const { toc } = buildToc(blocks);
    expect(toc.map((t) => t.text)).toEqual(["Intro", "Details"]);
  });

  test("a heading nested inside a quote is collected with a correct anchor", () => {
    const blocks: Block[] = [
      { t: "quote", blocks: [heading(2, "Nested Section")] },
    ];
    const { toc, anchorMap } = buildToc(blocks);
    expect(toc).toHaveLength(1);
    expect(toc[0].text).toBe("Nested Section");
    expect(anchorMap["0.0"]).toBe(toc[0].id);
  });

  test("headings nested inside nested quotes are all collected", () => {
    const blocks: Block[] = [
      {
        t: "quote",
        blocks: [
          heading(2, "Outer"),
          { t: "quote", blocks: [heading(3, "Inner")] },
        ],
      },
    ];
    const { toc, anchorMap } = buildToc(blocks);
    expect(toc.map((t) => t.text)).toEqual(["Outer", "Inner"]);
    expect(anchorMap["0.0"]).toBe(toc[0].id);
    expect(anchorMap["0.1.0"]).toBe(toc[1].id);
  });

  test("a heading nested inside a callout is collected (Phase 2 container)", () => {
    const blocks: Block[] = [
      { t: "callout", kind: "note", blocks: [heading(2, "Callout Section")] },
    ];
    const { toc, anchorMap } = buildToc(blocks);
    expect(toc).toHaveLength(1);
    expect(toc[0].text).toBe("Callout Section");
    expect(anchorMap["0.0"]).toBe(toc[0].id);
  });

  test("a heading nested inside a toggle is collected (Phase 3 container)", () => {
    const blocks: Block[] = [
      { t: "toggle", summary: "Details", blocks: [heading(2, "Toggle Section")] },
    ];
    const { toc, anchorMap } = buildToc(blocks);
    expect(toc).toHaveLength(1);
    expect(toc[0].text).toBe("Toggle Section");
    expect(anchorMap["0.0"]).toBe(toc[0].id);
  });

  test("headings nested inside each column of a columns block are collected with distinct keys", () => {
    const blocks: Block[] = [
      {
        t: "columns",
        columns: [[heading(2, "Column A")], [heading(2, "Column B")]],
      },
    ];
    const { toc, anchorMap } = buildToc(blocks);
    expect(toc.map((t) => t.text)).toEqual(["Column A", "Column B"]);
    expect(anchorMap["0.0.0"]).toBe(toc[0].id);
    expect(anchorMap["0.1.0"]).toBe(toc[1].id);
  });

  test("duplicate heading text de-dupes anchor ids with -2, -3 suffixes", () => {
    const blocks: Block[] = [heading(2, "Notes"), heading(2, "Notes")];
    const { toc } = buildToc(blocks);
    expect(toc[0].id).toBe("notes");
    expect(toc[1].id).toBe("notes-2");
  });

  test("non-container, non-heading blocks are ignored", () => {
    const blocks: Block[] = [
      { t: "paragraph", inl: [{ t: "text", v: "hello" }] },
      { t: "code", code: "1+1", lang: "js" },
      { t: "hr" },
    ];
    const { toc } = buildToc(blocks);
    expect(toc).toHaveLength(0);
  });
});
