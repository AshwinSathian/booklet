import { test, expect } from "@playwright/test";
import { JSDOM } from "jsdom";
import { sanitizeCompiledSvg } from "@/lib/svg-sanitize";

// sanitizeCompiledSvg uses the browser's DOMParser/XMLSerializer — it only
// ever runs client-side, after a dynamic ssr:false import in
// DiagramBlock.tsx — so this Node-based test runner needs jsdom to provide
// those globals. Phase 4 of PLAN-rich-markdown-blocks.md: Graphviz's DOT
// language supports HTML-like labels and per-node/edge URL/href attributes,
// either of which could carry a script or a javascript:/data: URI through
// to the rendered SVG without this sanitization step.
const dom = new JSDOM();
Object.assign(globalThis, {
  DOMParser: dom.window.DOMParser,
  XMLSerializer: dom.window.XMLSerializer,
});

const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';
const XLINK_NS = 'xmlns:xlink="http://www.w3.org/1999/xlink"';

test.describe("sanitizeCompiledSvg", () => {
  test("passes benign SVG through with its content intact", () => {
    const svg = `<svg ${SVG_NS}><circle cx="5" cy="5" r="4"/></svg>`;
    const out = sanitizeCompiledSvg(svg);
    expect(out).toContain("<circle");
    expect(out).toContain('cx="5"');
  });

  test("strips <script> elements entirely, keeping sibling content", () => {
    const svg = `<svg ${SVG_NS}><script>alert(1)</script><circle r="1"/></svg>`;
    const out = sanitizeCompiledSvg(svg);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(1)");
    expect(out).toContain("<circle");
  });

  test("strips foreignObject elements (HTML/script smuggling vector)", () => {
    const svg = `<svg ${SVG_NS}><foreignObject><div>x</div></foreignObject><circle r="1"/></svg>`;
    const out = sanitizeCompiledSvg(svg);
    expect(out.toLowerCase()).not.toContain("foreignobject");
    expect(out).toContain("<circle");
  });

  test("strips on* event handler attributes from any element", () => {
    const svg = `<svg ${SVG_NS}><rect onclick="alert(1)" onmouseover="alert(2)" width="1" height="1"/></svg>`;
    const out = sanitizeCompiledSvg(svg);
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onmouseover");
    expect(out).toContain("<rect");
  });

  test("strips a javascript: xlink:href (Graphviz URL/href attribute vector)", () => {
    const svg = `<svg ${SVG_NS} ${XLINK_NS}><a xlink:href="javascript:alert(1)"><text>node</text></a></svg>`;
    const out = sanitizeCompiledSvg(svg);
    expect(out).not.toContain("javascript:");
  });

  test("strips a data: href", () => {
    const svg = `<svg ${SVG_NS}><a href="data:text/html,evil"><text>x</text></a></svg>`;
    const out = sanitizeCompiledSvg(svg);
    expect(out).not.toContain("data:");
  });

  test("keeps a safe https href on an <a> element", () => {
    const svg = `<svg ${SVG_NS}><a href="https://example.com"><text>node</text></a></svg>`;
    const out = sanitizeCompiledSvg(svg);
    expect(out).toContain("https://example.com");
  });

  test("keeps a safe fragment href", () => {
    const svg = `<svg ${SVG_NS}><a href="#node1"><text>x</text></a></svg>`;
    const out = sanitizeCompiledSvg(svg);
    expect(out).toContain('href="#node1"');
  });

  test("returns empty string for unparseable input", () => {
    expect(sanitizeCompiledSvg("not svg at all { garbage")).toBe("");
  });

  test("returns empty string when the root element isn't <svg>", () => {
    expect(sanitizeCompiledSvg("<div>not an svg</div>")).toBe("");
  });
});
