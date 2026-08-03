import katex from "katex";
import type { Block, Inline, TableAlign } from "@/lib/blocks";
import { GRAPHVIZ_LANGS } from "@/lib/blocks";
import { parseToBlocks } from "@/lib/parse";
import { CALLOUT_META, sanitizeImageUrl, sanitizeUrl } from "@/lib/render-shared";
import { normalizeInput } from "@/lib/sanitize";
import { sanitizeCompiledSvg } from "@/lib/svg-sanitize";

// Inline styles (not class names) so callouts/tables render correctly both
// in the standalone document export (blocksToHtmlDocument, which ships a
// <style> block) and the unstyled clipboard fragment
// (markdownToHtml/blocksToHtml, pasted into email/Slack/Docs with no
// external stylesheet available). The label text comes from the single
// shared CALLOUT_META table (src/lib/render-shared.ts) also used by
// Callout.tsx — only the color *representation* differs by necessity
// (Tailwind classes there, inline hex here).
function calloutBg(hex: string): string {
  // Every CALLOUT_META.colorVar is a 7-char #rrggbb hex literal, so this is
  // a fixed-format transform, not general color parsing.
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},.08)`;
}

const TABLE_ALIGN_STYLE: Record<Exclude<TableAlign, null>, string> = {
  left: "text-align:left",
  center: "text-align:center",
  right: "text-align:right",
};

function tableAlignStyle(align: TableAlign[] | undefined, i: number): string {
  const a = align?.[i];
  return a ? ` style="${TABLE_ALIGN_STYLE[a]}"` : "";
}

/**
 * Convert the app's markdown (source of truth) into a clean HTML fragment.
 *
 * We intentionally:
 * - Reuse the existing markdown → block parser (to stay close to preview semantics)
 * - Generate a conservative, semantic HTML subset (email/doc friendly)
 * - Escape all user strings and defensively sanitize URLs
 */
export async function markdownToHtml(raw: string): Promise<string> {
  const normalized = normalizeInput(raw ?? "");
  // parseToBlocks never throws (see its own doc comment) — a catastrophic
  // parse failure degrades to an explanatory block, not an exception.
  const blocks: Block[] = normalized.trim() ? parseToBlocks(normalized) : [];
  return blocksToHtml(blocks);
}

export async function blocksToHtml(blocks: Block[]): Promise<string> {
  const inner = (await Promise.all(blocks.map(renderBlock))).join("");
  return `<div>${inner}</div>`;
}

export async function blocksToHtmlDocument(blocks: Block[], title: string): Promise<string> {
  const body = (await Promise.all(blocks.map(renderBlock))).join("\n");
  const safeTitle = escapeHtmlInner(title || "Booklet export");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
*,*::before,*::after{box-sizing:border-box}
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:720px;margin:0 auto;padding:2.5rem 1.5rem;line-height:1.65;color:#111827;background:#fff}
h1,h2,h3,h4{margin:1.5em 0 .5em;font-weight:700;line-height:1.25;color:#0f172a}
h1{font-size:2em}h2{font-size:1.5em}h3{font-size:1.25em}h4{font-size:1em}
p{margin:0 0 1em}
a{color:#4f46e5;text-decoration:underline}a:hover{color:#3730a3}
strong{font-weight:700}em{font-style:italic}del{text-decoration:line-through;color:#6b7280}
code{background:#f3f4f6;color:#1f2937;padding:.15em .4em;border-radius:4px;font-family:ui-monospace,Menlo,Monaco,"Cascadia Code",monospace;font-size:.875em}
pre{background:#f3f4f6;padding:1rem 1.25rem;border-radius:8px;overflow-x:auto;margin:0 0 1em}
pre code{background:none;padding:0;font-size:.875em}
blockquote{border-left:3px solid #d1d5db;margin:0 0 1em;padding:.25rem 0 .25rem 1rem;color:#6b7280}
blockquote p{margin:0}
table{border-collapse:collapse;width:100%;margin:0 0 1em;font-size:.9em}
th,td{border:1px solid #e5e7eb;padding:.5rem .75rem;text-align:left}
th{background:#f9fafb;font-weight:600;color:#374151}
img{max-width:100%;height:auto;border-radius:6px}
figure{margin:0 0 1em}figcaption{font-size:.875em;color:#6b7280;margin-top:.25em}
hr{border:none;border-top:1px solid #e5e7eb;margin:2rem 0}
ul,ol{padding-left:1.5rem;margin:0 0 1em}
li{margin:.25em 0}
input[type="checkbox"]{margin-right:.4em;vertical-align:middle}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function escapeHtmlInner(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function joinBlocks(blocks: Block[], sep = ""): Promise<string> {
  return (await Promise.all(blocks.map(renderBlock))).join(sep);
}

async function renderBlock(b: Block): Promise<string> {
  switch (b.t) {
    case "heading": {
      const level = clampHeadingLevel(b.level);
      return `<h${level}>${renderInlines(b.inl)}</h${level}>`;
    }
    case "paragraph":
      return `<p>${renderInlines(b.inl)}</p>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      const items = await Promise.all(
        b.items.map(async (it) => {
          const checkbox =
            it.checked != null
              ? `<input type="checkbox"${it.checked ? " checked" : ""} disabled />`
              : "";
          const text = renderInlines(it.inl);
          const nested = it.children?.length ? await blocksToHtml(it.children) : "";
          return `<li>${checkbox}${text}${nested}</li>`;
        }),
      );
      return `<${tag}>${items.join("")}</${tag}>`;
    }
    case "quote": {
      const inner = await joinBlocks(b.blocks);
      return `<blockquote>${inner}</blockquote>`;
    }
    case "callout": {
      const meta = CALLOUT_META[b.kind];
      const inner = await joinBlocks(b.blocks);
      return `<div style="border:1px solid ${meta.colorVar};background:${calloutBg(meta.colorVar)};border-radius:8px;padding:1rem;margin:0 0 1em"><p style="margin:0 0 .5em;font-weight:700;color:${meta.colorVar}">${escapeHtmlInner(meta.label)}</p>${inner}</div>`;
    }
    case "toggle": {
      const inner = await joinBlocks(b.blocks);
      // Native <details>/<summary> — every mainstream email/doc-paste target
      // either renders these correctly or degrades to always-expanded
      // content, never to nothing, so this is safe as an export fallback too.
      return `<details style="border:1px solid #e5e7eb;border-radius:8px;padding:.75rem 1rem;margin:0 0 1em"><summary style="cursor:pointer;font-weight:700">${escapeHtmlInner(b.summary)}</summary><div style="margin-top:.75rem">${inner}</div></details>`;
    }
    case "columns": {
      const cols = await Promise.all(
        b.columns.map(async (col) => `<div style="flex:1 1 0;min-width:0">${await joinBlocks(col)}</div>`),
      );
      return `<div style="display:flex;gap:1.25rem;flex-wrap:wrap;margin:0 0 1em">${cols.join("")}</div>`;
    }
    case "code": {
      const langClass = b.lang ? ` class="language-${escapeAttr(b.lang)}"` : "";
      return `<pre><code${langClass}>${escapeHtml(b.code)}</code></pre>`;
    }
    case "table": {
      const headCells = b.head
        .map((cell, i) => `<th${tableAlignStyle(b.align, i)}>${renderInlines(cell)}</th>`)
        .join("");
      const head = `<thead><tr>${headCells}</tr></thead>`;

      const bodyRows = b.rows
        .map((row) => {
          const tds = row
            .map((cell, i) => `<td${tableAlignStyle(b.align, i)}>${renderInlines(cell)}</td>`)
            .join("");
          return `<tr>${tds}</tr>`;
        })
        .join("");

      const body = `<tbody>${bodyRows}</tbody>`;
      return `<table>${head}${body}</table>`;
    }
    case "hr":
      return `<hr />`;
    case "image": {
      const safeSrc = sanitizeImageUrl(b.src);
      if (!safeSrc) return "";
      return `<figure><img src="${escapeAttr(safeSrc)}" alt="${escapeAttr(b.alt)}" />${b.alt ? `<figcaption>${escapeHtml(b.alt)}</figcaption>` : ""}</figure>`;
    }
    case "diagram": {
      // Graphviz/DOT diagrams compile to self-contained SVG here, same as
      // the live preview (DiagramBlock.tsx) — this module only ever runs
      // client-side (see ExportMenu.tsx/TopBar.tsx), so @viz-js/viz's WASM
      // module loads exactly the same way, just ahead of time at export
      // instead of on mount.
      //
      // Mermaid diagrams are NOT compiled here: Mermaid's layout engine
      // requires real browser text-measurement APIs (getBBox etc.) that
      // even Mermaid's own official CLI only gets by driving a full
      // headless Chromium — there's no lightweight way to do this inline
      // at export time. They're kept as clearly-labeled, syntax-highlighted
      // source (see the FAQ copy, which now says this explicitly instead of
      // implying every diagram renders).
      if (GRAPHVIZ_LANGS.has(b.lang)) {
        const svg = await renderGraphvizToSvg(b.code);
        if (svg) return svg;
      }
      const langClass = ` class="language-${escapeAttr(b.lang)}"`;
      return `<pre><code${langClass}>${escapeHtml(b.code)}</code></pre>`;
    }
    case "math": {
      // Compiled to MathML (output: "mathml") rather than KaTeX's default
      // HTML+CSS render — MathML needs no stylesheet or @font-face assets
      // to display, so the result is fully self-contained and every
      // mainstream browser renders it natively. Falls back to source text
      // only if KaTeX can't parse the input at all.
      const html = renderMathToMathml(b.code, true);
      if (html) {
        return `<div style="overflow-x:auto;padding:.5rem 0;text-align:center">${html}</div>`;
      }
      return `<pre><code class="language-latex">${escapeHtml(b.code)}</code></pre>`;
    }
    case "footnotes": {
      const items = await Promise.all(
        b.items.map(async (item) => {
          const inner = await joinBlocks(item.blocks);
          return `<li id="fn-${escapeAttr(item.id)}">${inner} <a href="#fnref-${escapeAttr(item.id)}">↩</a></li>`;
        }),
      );
      return `<hr /><section aria-label="Footnotes"><ol>${items.join("")}</ol></section>`;
    }
    default:
      return "";
  }
}

function renderInlines(inl: Inline[]): string {
  return inl.map(renderInline).join("");
}

function renderInline(i: Inline): string {
  switch (i.t) {
    case "text":
      return escapeHtml(i.v);
    case "strong":
      return `<strong>${renderInlines(i.c)}</strong>`;
    case "em":
      return `<em>${renderInlines(i.c)}</em>`;
    case "code":
      return `<code>${escapeHtml(i.v)}</code>`;
    case "link": {
      const safeHref = escapeAttr(sanitizeUrl(i.href));
      return `<a href="${safeHref}" rel="noopener noreferrer">${renderInlines(i.c)}</a>`;
    }
    case "del":
      return `<del>${renderInlines(i.c)}</del>`;
    case "image": {
      const safeSrc = sanitizeImageUrl(i.src);
      if (!safeSrc) return "";
      return `<img src="${escapeAttr(safeSrc)}" alt="${escapeAttr(i.alt)}" />`;
    }
    case "math": {
      const html = renderMathToMathml(i.v, false);
      return html ? `<span>${html}</span>` : `<code>${escapeHtml(i.v)}</code>`;
    }
    case "footnoteRef":
      return `<sup><a href="#fn-${escapeAttr(i.id)}" id="fnref-${escapeAttr(i.id)}">[${i.n}]</a></sup>`;
    case "wikilink":
      // Private, drafting-time-only concept (src/lib/blocks.ts) — exported
      // HTML (from the editor's live "Copy as HTML", which parses raw draft
      // content directly, not the stripped/stored blocks) shows plain text,
      // never bracket syntax or a broken link.
      return escapeHtml(i.label ?? i.target);
    default:
      return "";
  }
}

/**
 * Compile LaTeX to standalone MathML (no CSS/font dependency — see the
 * `math` case in renderBlock for why that matters for a self-contained
 * export). Returns null on genuinely unparseable input so callers can fall
 * back to source text; KaTeX's own throwOnError:false already renders most
 * errors as styled inline text rather than throwing, so the null path is a
 * defensive fallback, not the common case.
 */
function renderMathToMathml(code: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(code, { throwOnError: false, output: "mathml", displayMode });
  } catch {
    return null;
  }
}

// Cached across an export call (and across multiple exports in the same
// page session) so a document with several Graphviz/DOT diagrams only pays
// the WASM instantiation cost once. Dynamically imported, same as
// DiagramBlock.tsx's live-preview path, so pages/exports with no diagrams
// never pull in the WASM payload at all.
let vizInstance: ReturnType<typeof import("@viz-js/viz")["instance"]> | null = null;

function getViz() {
  vizInstance ??= import("@viz-js/viz").then(({ instance }) => instance());
  return vizInstance;
}

async function renderGraphvizToSvg(code: string): Promise<string | null> {
  try {
    const viz = await getViz();
    const result = viz.render(code.trim(), { format: "svg" });
    if (result.status !== "success") return null;
    return sanitizeCompiledSvg(result.output) || null;
  } catch {
    return null;
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  // Attributes are also escaped, but kept separate for readability.
  return escapeHtml(s);
}

function clampHeadingLevel(level: number): 1 | 2 | 3 | 4 {
  if (level <= 1) return 1;
  if (level === 2) return 2;
  if (level === 3) return 3;
  return 4;
}
