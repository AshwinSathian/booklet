import { GRAPHVIZ_LANGS } from "@/lib/blocks";
import { sanitizeCompiledSvg } from "@/lib/svg-sanitize";
import type { RenderedDiagrams } from "./html";

/** Source of every Mermaid diagram in a block tree, however deeply nested. */
function mermaidSources(node: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(node)) node.forEach((n) => mermaidSources(n, out));
  else if (node && typeof node === "object") {
    const b = node as { t?: unknown; lang?: unknown; code?: unknown };
    if (b.t === "diagram" && typeof b.lang === "string" && typeof b.code === "string" && !GRAPHVIZ_LANGS.has(b.lang)) out.add(b.code);
    else Object.values(node).forEach((v) => mermaidSources(v, out));
  }
  return out;
}

/**
 * Draws a document's Mermaid diagrams for the HTML export, keyed by source,
 * with the renderer the page itself uses. Browser only: Mermaid lays out
 * with the browser's text measurement.
 *
 * Drawn here and not copied off the page, so the export does not depend on
 * which diagrams have finished rendering or on the reader's theme: the
 * exported document is light, and so are these. Labels are SVG text
 * (`htmlLabels: false`), because each SVG goes through the sanitizer, which
 * removes foreignObject. The export is a file people open and forward, so
 * it must not carry script, event handlers or `javascript:` links.
 *
 * A diagram Mermaid cannot draw is left out, and exports as its source.
 */
export async function renderDiagramsForExport(blocks: unknown): Promise<RenderedDiagrams> {
  const out = new Map<string, string>();
  const sources = mermaidSources(blocks);
  if (sources.size === 0) return out;

  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict", htmlLabels: false, flowchart: { htmlLabels: false } });
  try {
    for (const source of sources) {
      try {
        const { svg } = await mermaid.render(`export-${Math.random().toString(36).slice(2)}`, source.trim());
        const clean = sanitizeCompiledSvg(svg);
        if (clean) out.set(source, clean);
      } catch {
        // Falls back to the diagram's source in the export.
      }
    }
  } finally {
    // Mermaid's configuration is global: give the page's own diagrams their HTML labels back.
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", htmlLabels: true, flowchart: { htmlLabels: true } });
  }
  return out;
}
