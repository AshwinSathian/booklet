import { test, expect } from "@playwright/test";
import { validateBlocks } from "@/lib/block-schema";
import type { Block } from "@/lib/blocks";

// Phase 1 of PLAN-rich-markdown-blocks.md: before this schema existed, the
// three write endpoints (api/publish, api/v1/publish, api/v1/pages/[id]
// PATCH) accepted any array as `blocks` with zero shape validation.

test.describe("validateBlocks", () => {
  test("accepts one example of every current block kind", () => {
    const blocks: Block[] = [
      { t: "heading", level: 1, inl: [{ t: "text", v: "Title" }] },
      { t: "paragraph", inl: [{ t: "strong", c: [{ t: "text", v: "hi" }] }] },
      {
        t: "list",
        ordered: false,
        items: [{ inl: [{ t: "text", v: "item" }], checked: null }],
      },
      { t: "quote", blocks: [{ t: "paragraph", inl: [{ t: "text", v: "q" }] }] },
      { t: "callout", kind: "tip", blocks: [{ t: "paragraph", inl: [{ t: "text", v: "c" }] }] },
      { t: "toggle", summary: "More", blocks: [{ t: "paragraph", inl: [{ t: "text", v: "t" }] }] },
      {
        t: "columns",
        columns: [
          [{ t: "paragraph", inl: [{ t: "text", v: "left" }] }],
          [{ t: "paragraph", inl: [{ t: "text", v: "right" }] }],
        ],
      },
      { t: "code", lang: "ts", code: "const x = 1;" },
      {
        t: "table",
        head: [[{ t: "text", v: "A" }]],
        rows: [[[{ t: "text", v: "1" }]]],
      },
      { t: "hr" },
      { t: "image", src: "https://example.com/a.png", alt: "alt text" },
      { t: "diagram", lang: "mermaid", code: "graph TD; A-->B;" },
      { t: "math", display: true, code: "x^2" },
    ];
    expect(validateBlocks(blocks)).toBeNull();
  });

  test("accepts nested list items with children", () => {
    const blocks: Block[] = [
      {
        t: "list",
        ordered: true,
        items: [
          {
            inl: [{ t: "text", v: "parent" }],
            children: [{ t: "paragraph", inl: [{ t: "text", v: "nested" }] }],
          },
        ],
      },
    ];
    expect(validateBlocks(blocks)).toBeNull();
  });

  test("rejects a non-array payload", () => {
    expect(validateBlocks({ not: "an array" })).not.toBeNull();
    expect(validateBlocks(null)).not.toBeNull();
    expect(validateBlocks("blocks")).not.toBeNull();
  });

  test("rejects an unknown block kind", () => {
    const blocks = [{ t: "script", src: "evil.js" }];
    expect(validateBlocks(blocks)).not.toBeNull();
  });

  test("rejects a known kind with a missing required field", () => {
    const blocks = [{ t: "heading", level: 1 }]; // missing `inl`
    expect(validateBlocks(blocks)).not.toBeNull();
  });

  test("rejects a callout with an unrecognized kind", () => {
    const blocks = [{ t: "callout", kind: "danger", blocks: [] }];
    expect(validateBlocks(blocks)).not.toBeNull();
  });

  test("rejects a columns block with fewer than 2 columns", () => {
    const blocks = [{ t: "columns", columns: [[]] }];
    expect(validateBlocks(blocks)).not.toBeNull();
  });

  test("rejects a columns block with more than 4 columns", () => {
    const blocks = [{ t: "columns", columns: [[], [], [], [], []] }];
    expect(validateBlocks(blocks)).not.toBeNull();
  });

  test("accepts a columns block at each valid boundary (2 and 4)", () => {
    expect(validateBlocks([{ t: "columns", columns: [[], []] }])).toBeNull();
    expect(validateBlocks([{ t: "columns", columns: [[], [], [], []] }])).toBeNull();
  });

  test("rejects a heading level outside 1-4", () => {
    const blocks = [{ t: "heading", level: 5, inl: [] }];
    expect(validateBlocks(blocks)).not.toBeNull();
  });

  test("rejects the legacy bare-Inline[]-array list item shape", () => {
    // Old published docs may contain this shape (BlockRenderer reads it
    // defensively) but new writes must use the current object shape.
    const blocks = [
      { t: "list", ordered: false, items: [[{ t: "text", v: "legacy" }]] },
    ];
    expect(validateBlocks(blocks)).not.toBeNull();
  });

  test("error message includes the offending block index", () => {
    const blocks = [
      { t: "paragraph", inl: [{ t: "text", v: "ok" }] },
      { t: "heading", level: 1 }, // invalid, at index 1
    ];
    const err = validateBlocks(blocks);
    expect(err).toContain("blocks[1");
  });
});
