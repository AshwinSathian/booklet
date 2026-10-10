import { sanitizeCompiledSvg } from "@/lib/svg-sanitize";
import type { RenderedDiagrams } from "./html";

/** Set by DiagramBlock on the element that holds a rendered Mermaid SVG. */
export const MERMAID_SOURCE_ATTR = "data-mermaid-source";

/**
 * Copies the Mermaid diagrams currently drawn on the page for the HTML
 * export, keyed by diagram source. Each SVG goes through the sanitizer
 * before it leaves the page: the export is a file people open and forward,
 * so it must not carry script, event handlers or `javascript:` links even
 * if a diagram's source managed to put one in the DOM.
 *
 * A diagram drawn in the dark theme has light strokes and text, so it gets
 * a dark panel behind it; the exported document itself is light.
 */
export function collectRenderedDiagrams(root: ParentNode = document): RenderedDiagrams {
  const dark = !document.documentElement.classList.contains("light");
  const out = new Map<string, string>();
  for (const holder of Array.from(root.querySelectorAll(`[${MERMAID_SOURCE_ATTR}]`))) {
    const source = holder.getAttribute(MERMAID_SOURCE_ATTR);
    const svg = holder.querySelector("svg");
    if (!source || !svg || out.has(source)) continue;
    // XMLSerializer, not outerHTML: the sanitizer parses strict XML.
    const clean = sanitizeCompiledSvg(new XMLSerializer().serializeToString(svg));
    if (!clean) continue;
    out.set(
      source,
      dark ? `<div style="background:#16161a;border-radius:8px;padding:16px;text-align:center">${clean}</div>` : clean,
    );
  }
  return out;
}
