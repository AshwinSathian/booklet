// Sanitizes SVG markup produced by a diagram compiler (Graphviz via
// @viz-js/viz) before it's assigned via innerHTML in DiagramBlock. Diagram
// source is user-controlled text (a fenced code block's contents) — DOT
// supports HTML-like labels and per-node/edge `URL`/`href` attributes, both
// of which can carry a script or a `javascript:`/`data:` URI through to the
// rendered SVG if not stripped here. This is what closes the one new attack
// surface Phase 4 of PLAN-rich-markdown-blocks.md introduces, mirroring the
// guarantee Mermaid's own `securityLevel: "strict"` gives the existing
// diagram renderer (which this file intentionally does not touch).
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

function isSafeHref(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (!v) return true;
  if (v.startsWith("#")) return true;
  return v.startsWith("http://") || v.startsWith("https://") || v.startsWith("mailto:");
}

/** Returns sanitized SVG markup, or "" if the input isn't parseable SVG. */
export function sanitizeCompiledSvg(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");

  if (doc.querySelector("parsererror")) return "";

  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== "svg") return "";

  for (const el of Array.from(root.querySelectorAll("*"))) {
    const tag = el.nodeName.toLowerCase();
    if (DISALLOWED_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      } else if (HREF_ATTRS.has(name) && !isSafeHref(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return new XMLSerializer().serializeToString(root);
}
