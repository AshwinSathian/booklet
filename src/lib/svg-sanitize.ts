// Sanitizes SVG markup produced by a diagram compiler before it reaches the
// page: Graphviz (via @viz-js/viz) and the Mermaid SVG drawn for the HTML
// export go through sanitizeCompiledSvg; the Mermaid SVG drawn on the page
// itself goes through sanitizeRenderedSvg. Diagram
// source is user-controlled text (a fenced code block's contents) — DOT
// supports HTML-like labels and per-node/edge `URL`/`href` attributes, both
// of which can carry a script or a `javascript:`/`data:` URI through to the
// rendered SVG if not stripped here. This is what closes the one new attack
// surface Phase 4 of PLAN-rich-markdown-blocks.md introduces, mirroring the
// guarantee Mermaid's own `securityLevel: "strict"` gives its renderer.
//
// Uses DOMParser (browser-only; this module is only ever imported from a
// "use client" component after a dynamic, ssr:false import), not regex —
// regex-based HTML/SVG sanitization is a well-known source of "mutation
// XSS" bugs; letting the browser's own parser build the tree and walking it
// is far more reliable.

const DISALLOWED_TAGS = new Set([
  "script",
  "foreignobject",
  "iframe",
  "embed",
  "object",
  // SMIL animation elements: a well-known SVG-sanitizer bypass class — e.g.
  // <set attributeName="xlink:href" to="javascript:..."> can re-bind an
  // href/on* attribute after the static checks below have already run.
  // Not currently reachable through Graphviz's DOT/HTML-label grammar (the
  // only producer of this SVG), but this sanitizer shouldn't rely on that.
  "set",
  "animate",
  "animatetransform",
  "animatemotion",
]);
const HREF_ATTRS = new Set(["href", "xlink:href"]);

/** A link a reader may follow: a place in this document or site, or a web, mail or phone address. */
function isSafeHref(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  if (v.startsWith("#")) return true;
  // A path on this site: "/p/x", "./x", "../x", "?q". Not "//host", which is another host.
  if (/^(\/(?!\/)|\.\.?\/|\?)/.test(v)) return true;
  return v.startsWith("http://") || v.startsWith("https://") || v.startsWith("mailto:") || v.startsWith("tel:");
}

/**
 * What an element that fetches as soon as it is drawn may point at: a place
 * in this document or inline data. A diagram loads nothing from anywhere
 * else, so reading a page never tells a third host that it was read through
 * a diagram. (Markdown images in the page body are a separate, deliberate
 * feature and are not affected.)
 */
function isInertSource(value: string): boolean {
  const v = value.trim().toLowerCase();
  return !v || v.startsWith("#") || v.startsWith("data:image/");
}

// Elements whose href is fetched on render, not followed on click.
const LOADS_ITS_HREF = new Set(["image", "use", "feimage", "script", "pattern", "filter", "lineargradient", "radialgradient", "textpath", "mpath"]);
// Attributes that are fetched on render wherever they appear.
const SOURCE_ATTRS = new Set(["src", "srcset", "poster", "background", "data", "ping", "lowsrc", "dynsrc"]);

/** CSS as the browser will read it: comments gone, escapes decoded (`\75rl(` is `url(`). */
function decodeCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex: string) => {
      const cp = parseInt(hex, 16);
      return String.fromCodePoint(cp === 0 || cp > 0x10ffff ? 0xfffd : cp);
    })
    .replace(/\\([^\n])/g, "$1");
}

/**
 * CSS that loads nothing: no `@import`, no `image-set()`, and no `url()`
 * other than a same-document reference (`url(#grad)`, quoted or not) or
 * inline `data:`. An unterminated `url(` counts, since CSS closes it at the
 * end of the text.
 *
 * Text filtering, unlike the DOM walk around it, because the SVG parser
 * hands a stylesheet over as one string. Escapes and comments are resolved
 * first so that what is matched is what the browser will see.
 *
 * Run until nothing changes: one pass can leave behind exactly what it was
 * looking for (`\5c\5c 75rl(` decodes to `\75rl(`, and removing the inner
 * `@import;` of `@im@import;port` joins the outer one). Every pass that
 * changes the text shortens it or settles a `url()`, so the loop ends.
 */
export function inertCss(css: string): string {
  let out = css;
  let before: string;
  do {
    before = out;
    out = (out.includes("\\") || out.includes("/*") ? decodeCss(out) : out)
      .replace(/@import[^;]*;?/gi, "")
      .replace(/(?:-webkit-)?image-set\([^)]*(?:\)|$)/gi, "none")
      .replace(/url\(([^)]*)(?:\)|$)/gi, (whole, arg: string) => {
        const target = arg.trim().replace(/^['"]|['"]$/g, "").trim().toLowerCase();
        return target.startsWith("#") || target.startsWith("data:") ? whole : "none";
      });
  } while (out !== before);
  return out;
}

// HTML that has no business inside a diagram label. Mermaid draws labels as
// HTML in a <foreignObject>; its own DOMPurify pass lets form controls
// through, and a published page must not be able to show a sign-in form.
const DISALLOWED_IN_LABELS = new Set(["form", "input", "button", "textarea", "select", "option", "link", "meta", "base", "frame", "frameset", "portal"]);

/** Removes, in place, everything under `root` (and on it) that could run script or load something. */
function clean(root: Element, opts: { labels: boolean }): void {
  // The root too: `<svg onload=...>` is an event handler like any other.
  for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) {
    const tag = el.nodeName.toLowerCase();
    const allowedLabel = opts.labels && tag === "foreignobject";
    if ((DISALLOWED_TAGS.has(tag) && !allowedLabel) || (opts.labels && DISALLOWED_IN_LABELS.has(tag))) {
      el.remove();
      continue;
    }
    // Mermaid ships its own <style>. Nothing in it needs to load anything.
    if (tag === "style") el.textContent = inertCss(el.textContent ?? "");
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      } else if (HREF_ATTRS.has(name) && LOADS_ITS_HREF.has(tag) && !isInertSource(attr.value)) {
        el.removeAttribute(attr.name);
      } else if (SOURCE_ATTRS.has(name) && !isInertSource(attr.value)) {
        el.removeAttribute(attr.name);
      } else if ((HREF_ATTRS.has(name) || name === "action" || name === "formaction") && !isSafeHref(attr.value)) {
        el.removeAttribute(attr.name);
      } else if (name === "style") {
        el.setAttribute(attr.name, inertCss(attr.value));
      }
    }
  }
}

/**
 * The SVG a diagram compiler produced (Graphviz), as a sanitized element
 * ready to mount, or null if the markup is not parseable SVG. Parsed as XML:
 * the compiler emits a standalone SVG document.
 */
export function sanitizeCompiledSvgElement(svg: string): Element | null {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") return null;
  clean(root, { labels: false });
  return root;
}

/**
 * The same, as markup, or "" if the input isn't parseable SVG. For the HTML
 * export, which is a file and so has to be text. On the page, mount the
 * element instead: a string would be parsed a second time.
 */
export function sanitizeCompiledSvg(svg: string): string {
  const root = sanitizeCompiledSvgElement(svg);
  return root ? new XMLSerializer().serializeToString(root) : "";
}

/**
 * The SVG Mermaid drew for the page, as an element ready to mount, or null
 * if the markup is not one <svg>.
 *
 * Differs from sanitizeCompiledSvg in three ways, all because of how
 * Mermaid draws labels: HTML inside <foreignObject>, with unclosed <br>.
 * So the markup is parsed as HTML, not XML; <foreignObject> stays, with
 * form controls and document-level elements removed from inside it; and
 * the result is the parsed tree itself, not a string. Returning the tree
 * means what was checked is what gets mounted: there is no second
 * serialise-and-parse for a browser to read differently.
 *
 * Mermaid's `securityLevel: "strict"` has already run DOMPurify over this
 * markup. What that leaves, and this removes, is anything that fetches from
 * another host when the diagram is drawn: CSS (`themeCSS` in an init
 * directive reaches the <style> element), and <img> or <image> in a label
 * or an image shape.
 */
export function sanitizeRenderedSvg(svg: string): Element | null {
  const body = new DOMParser().parseFromString(svg, "text/html").body;
  const root = body.firstElementChild;
  if (!root || body.children.length !== 1 || root.nodeName.toLowerCase() !== "svg") return null;
  clean(root, { labels: true });
  return root;
}
