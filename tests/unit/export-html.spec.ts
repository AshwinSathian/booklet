import { test, expect } from "@playwright/test";
import { blocksToHtml } from "@/lib/export/html";
import type { Block } from "@/lib/blocks";

// Every renderBlock case in src/lib/export/html.ts has a `default: return ""`
// fallback — a new Block kind that isn't given its own case silently
// disappears from HTML export instead of erroring. This file exists so
// adding a new Block kind (Phase 2+ of PLAN-rich-markdown-blocks.md) without
// a matching export case fails a test instead of failing silently in prod.

test.describe("blocksToHtml — callout export", () => {
  test("renders a callout with its label and nested content, not empty", () => {
    const blocks: Block[] = [
      {
        t: "callout",
        kind: "warning",
        blocks: [{ t: "paragraph", inl: [{ t: "text", v: "Be careful." }] }],
      },
    ];
    const html = blocksToHtml(blocks);
    expect(html).toContain("Warning");
    expect(html).toContain("Be careful.");
  });

  test("every callout kind renders a non-empty, distinctly labeled block", () => {
    const kinds = ["note", "tip", "warning", "important", "caution"] as const;
    const labels = ["Note", "Tip", "Warning", "Important", "Caution"];
    for (let i = 0; i < kinds.length; i++) {
      const html = blocksToHtml([{ t: "callout", kind: kinds[i], blocks: [] }]);
      expect(html).toContain(labels[i]);
    }
  });

  test("callout body text is still HTML-escaped", () => {
    const html = blocksToHtml([
      {
        t: "callout",
        kind: "note",
        blocks: [{ t: "paragraph", inl: [{ t: "text", v: "<script>alert(1)</script>" }] }],
      },
    ]);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

test.describe("blocksToHtml — toggle export", () => {
  test("renders as a native <details>/<summary> with the summary text and nested content", () => {
    const html = blocksToHtml([
      {
        t: "toggle",
        summary: "Click here",
        blocks: [{ t: "paragraph", inl: [{ t: "text", v: "Hidden body." }] }],
      },
    ]);
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Click here");
    expect(html).toContain("Hidden body.");
  });

  test("summary text is HTML-escaped", () => {
    const html = blocksToHtml([
      { t: "toggle", summary: "<b>bold</b>", blocks: [] },
    ]);
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;b&gt;");
  });
});

test.describe("blocksToHtml — columns export", () => {
  test("renders every column's content, not just the first", () => {
    const html = blocksToHtml([
      {
        t: "columns",
        columns: [
          [{ t: "paragraph", inl: [{ t: "text", v: "Left content" }] }],
          [{ t: "paragraph", inl: [{ t: "text", v: "Right content" }] }],
        ],
      },
    ]);
    expect(html).toContain("Left content");
    expect(html).toContain("Right content");
  });
});

// Regression: `renderBlock`'s switch had no `case "math"` at all, so a math
// block silently vanished (fell to `default: return ""`) from every export
// path (blocksToHtml / blocksToHtmlDocument / the TopBar "Copy as HTML"
// button), even though it rendered fine in the live preview.
test.describe("blocksToHtml — math export", () => {
  test("a math block is no longer silently dropped", () => {
    const html = blocksToHtml([{ t: "math", display: true, code: "E = mc^2" }]);
    expect(html).not.toBe("<div></div>");
    expect(html).toContain("E = mc^2");
  });

  test("math source is HTML-escaped, not interpreted", () => {
    const html = blocksToHtml([{ t: "math", display: true, code: "a < b & c > d" }]);
    expect(html).toContain("&lt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&gt;");
  });

  test("inline math is no longer silently dropped", () => {
    const html = blocksToHtml([
      { t: "paragraph", inl: [{ t: "text", v: "area is " }, { t: "math", v: "r^2" }] },
    ]);
    expect(html).toContain("r^2");
  });
});

test.describe("blocksToHtml — footnotes export", () => {
  test("renders a numbered, cross-linked footnote section", () => {
    const html = blocksToHtml([
      { t: "paragraph", inl: [{ t: "text", v: "Fact." }, { t: "footnoteRef", id: "1", n: 1 }] },
      { t: "footnotes", items: [{ id: "1", n: 1, blocks: [{ t: "paragraph", inl: [{ t: "text", v: "Source." }] }] }] },
    ]);
    expect(html).toContain("Source.");
    expect(html).toContain('href="#fn-1"');
    expect(html).toContain('id="fn-1"');
    expect(html).toContain('href="#fnref-1"');
  });
});

test.describe("blocksToHtml — table alignment export", () => {
  test("applies a text-align style per column", () => {
    const html = blocksToHtml([
      {
        t: "table",
        head: [[{ t: "text", v: "A" }], [{ t: "text", v: "B" }]],
        rows: [],
        align: ["center", "right"],
      },
    ]);
    expect(html).toContain('style="text-align:center"');
    expect(html).toContain('style="text-align:right"');
  });

  test("an unset column has no alignment style", () => {
    const html = blocksToHtml([
      { t: "table", head: [[{ t: "text", v: "A" }]], rows: [], align: [null] },
    ]);
    expect(html).not.toContain("text-align");
  });
});
