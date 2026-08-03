import { test, expect } from "@playwright/test";
import { JSDOM } from "jsdom";
import { blocksToHtml } from "@/lib/export/html";
import type { Block } from "@/lib/blocks";

// Every renderBlock case in src/lib/export/html.ts has a `default: return ""`
// fallback — a new Block kind that isn't given its own case silently
// disappears from HTML export instead of erroring. This file exists so
// adding a new Block kind (Phase 2+ of PLAN-rich-markdown-blocks.md) without
// a matching export case fails a test instead of failing silently in prod.
//
// blocksToHtml is async (diagram/math compilation is), so every call site
// below is awaited.
//
// The diagram tests exercise the Graphviz/DOT compile path, which sanitizes
// the compiled SVG via src/lib/svg-sanitize.ts — a browser-only module
// (DOMParser/XMLSerializer). This module only ever runs client-side in the
// app itself, but this Node-based test runner has no DOM, so we provide the
// same jsdom stand-in already used by svg-sanitize.spec.ts.
const dom = new JSDOM();
Object.assign(globalThis, {
  DOMParser: dom.window.DOMParser,
  XMLSerializer: dom.window.XMLSerializer,
});

test.describe("blocksToHtml — callout export", () => {
  test("renders a callout with its label and nested content, not empty", async () => {
    const blocks: Block[] = [
      {
        t: "callout",
        kind: "warning",
        blocks: [{ t: "paragraph", inl: [{ t: "text", v: "Be careful." }] }],
      },
    ];
    const html = await blocksToHtml(blocks);
    expect(html).toContain("Warning");
    expect(html).toContain("Be careful.");
  });

  test("every callout kind renders a non-empty, distinctly labeled block", async () => {
    const kinds = ["note", "tip", "warning", "important", "caution"] as const;
    const labels = ["Note", "Tip", "Warning", "Important", "Caution"];
    for (let i = 0; i < kinds.length; i++) {
      const html = await blocksToHtml([{ t: "callout", kind: kinds[i], blocks: [] }]);
      expect(html).toContain(labels[i]);
    }
  });

  test("callout body text is still HTML-escaped", async () => {
    const html = await blocksToHtml([
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
  test("renders as a native <details>/<summary> with the summary text and nested content", async () => {
    const html = await blocksToHtml([
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

  test("summary text is HTML-escaped", async () => {
    const html = await blocksToHtml([
      { t: "toggle", summary: "<b>bold</b>", blocks: [] },
    ]);
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;b&gt;");
  });
});

test.describe("blocksToHtml — columns export", () => {
  test("renders every column's content, not just the first", async () => {
    const html = await blocksToHtml([
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

// Regression coverage for "standalone HTML export silently drops Mermaid
// diagrams and KaTeX math to raw source text": math and Graphviz/DOT
// diagrams now compile to self-contained MathML/SVG at export time instead
// of degrading to a <pre><code> source dump.
test.describe("blocksToHtml — math export", () => {
  test("a display math block compiles to real MathML, not raw source text", async () => {
    const html = await blocksToHtml([{ t: "math", display: true, code: "E = mc^2" }]);
    expect(html).toContain("<math");
    expect(html).toContain("display=\"block\"");
    // KaTeX's MathML output always retains the original TeX in an
    // <annotation>, so this is still a reasonable substring check, but the
    // block must NOT be the old raw-source fallback shape.
    expect(html).not.toContain("<pre><code");
  });

  test("inline math compiles to MathML without display=\"block\"", async () => {
    const html = await blocksToHtml([
      { t: "paragraph", inl: [{ t: "text", v: "area is " }, { t: "math", v: "r^2" }] },
    ]);
    expect(html).toContain("<math");
    expect(html).not.toContain("display=\"block\"");
    expect(html).not.toContain("<pre><code");
  });

  test("invalid LaTeX never throws — renders KaTeX's own self-contained error span", async () => {
    // katex.renderToString(..., { throwOnError: false }) already catches
    // parse errors internally (even pathological ones like a macro-expansion
    // guard trip) and returns a styled inline error span rather than
    // throwing — verified directly against the katex package, not assumed.
    // renderMathToMathml's own try/catch is a defensive backstop for
    // whatever's left, but this asserts the export never crashes or leaks a
    // raw, un-rendered block for bad input.
    const html = await blocksToHtml([
      { t: "math", display: true, code: "\\gdef\\x{\\x\\x}\\x" },
    ]);
    expect(html).toContain("katex-error");
    expect(html).not.toBe("<div></div>");
  });

  test("math output never renders an <a> tag even from \\href (KaTeX trust defaults to false)", async () => {
    const html = await blocksToHtml([
      { t: "math", display: true, code: "\\href{javascript:alert(1)}{click}" },
    ]);
    // \href is a "trust"-gated command; with the default trust:false it's
    // rejected and rendered as inert error text — the "javascript:" string
    // only ever appears as escaped text content inside the inert <annotation>
    // (the original-source echo, not a live attribute), never as a real
    // href, so no <a> element is produced at all.
    expect(html).not.toContain("<a ");
  });
});

test.describe("blocksToHtml — diagram export", () => {
  test("a Graphviz/DOT diagram compiles to an inline, sanitized <svg>", async () => {
    const html = await blocksToHtml([
      { t: "diagram", lang: "dot", code: "digraph { a -> b }" },
    ]);
    expect(html).toContain("<svg");
    expect(html).not.toContain("<pre><code");
  });

  test("the 'graphviz' lang alias is treated the same as 'dot'", async () => {
    const html = await blocksToHtml([
      { t: "diagram", lang: "graphviz", code: "digraph { a -> b }" },
    ]);
    expect(html).toContain("<svg");
  });

  test("invalid DOT syntax falls back to escaped source instead of throwing", async () => {
    const html = await blocksToHtml([
      { t: "diagram", lang: "dot", code: "this is not valid dot {{{" },
    ]);
    expect(html).toContain("<pre><code");
    expect(html).toContain("language-dot");
  });

  test("a Mermaid diagram stays as syntax-highlighted source (documented limitation, not a silent drop)", async () => {
    const html = await blocksToHtml([
      { t: "diagram", lang: "mermaid", code: "graph TD; A-->B;" },
    ]);
    expect(html).toContain("<pre><code");
    expect(html).toContain("language-mermaid");
    expect(html).toContain("A--&gt;B");
  });
});

test.describe("blocksToHtml — footnotes export", () => {
  test("renders a numbered, cross-linked footnote section", async () => {
    const html = await blocksToHtml([
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
  test("applies a text-align style per column", async () => {
    const html = await blocksToHtml([
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

  test("an unset column has no alignment style", async () => {
    const html = await blocksToHtml([
      { t: "table", head: [[{ t: "text", v: "A" }]], rows: [], align: [null] },
    ]);
    expect(html).not.toContain("text-align");
  });
});
