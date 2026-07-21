import type { Block, Inline, TableAlign } from "@/lib/blocks";
import { parseToBlocks } from "@/lib/parse";
import { CALLOUT_META, sanitizeImageUrl, sanitizeUrl } from "@/lib/render-shared";
import { normalizeInput } from "@/lib/sanitize";

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
export function markdownToHtml(raw: string): string {
  const normalized = normalizeInput(raw ?? "");
  // parseToBlocks never throws (see its own doc comment) — a catastrophic
  // parse failure degrades to an explanatory block, not an exception.
  const blocks: Block[] = normalized.trim() ? parseToBlocks(normalized) : [];
  return blocksToHtml(blocks);
}

export function blocksToHtml(blocks: Block[]): string {
  const inner = blocks.map(renderBlock).join("");
  return `<div>${inner}</div>`;
}

export function blocksToHtmlDocument(blocks: Block[], title: string): string {
  const body = blocks.map(renderBlock).join("\n");
  const safeTitle = escapeHtmlInner(title || "Readable export");
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

function renderBlock(b: Block): string {
  switch (b.t) {
    case "heading": {
      const level = clampHeadingLevel(b.level);
      return `<h${level}>${renderInlines(b.inl)}</h${level}>`;
    }
    case "paragraph":
      return `<p>${renderInlines(b.inl)}</p>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      const items = b.items
        .map((it) => {
          const checkbox =
            it.checked != null
              ? `<input type="checkbox"${it.checked ? " checked" : ""} disabled />`
              : "";
          const text = renderInlines(it.inl);
          const nested = it.children?.length ? blocksToHtml(it.children) : "";
          return `<li>${checkbox}${text}${nested}</li>`;
        })
        .join("");
      return `<${tag}>${items}</${tag}>`;
    }
    case "quote": {
      const inner = b.blocks.map(renderBlock).join("");
      return `<blockquote>${inner}</blockquote>`;
    }
    case "callout": {
      const meta = CALLOUT_META[b.kind];
      const inner = b.blocks.map(renderBlock).join("");
      return `<div style="border:1px solid ${meta.colorVar};background:${calloutBg(meta.colorVar)};border-radius:8px;padding:1rem;margin:0 0 1em"><p style="margin:0 0 .5em;font-weight:700;color:${meta.colorVar}">${escapeHtmlInner(meta.label)}</p>${inner}</div>`;
    }
    case "toggle": {
      const inner = b.blocks.map(renderBlock).join("");
      // Native <details>/<summary> — every mainstream email/doc-paste target
      // either renders these correctly or degrades to always-expanded
      // content, never to nothing, so this is safe as an export fallback too.
      return `<details style="border:1px solid #e5e7eb;border-radius:8px;padding:.75rem 1rem;margin:0 0 1em"><summary style="cursor:pointer;font-weight:700">${escapeHtmlInner(b.summary)}</summary><div style="margin-top:.75rem">${inner}</div></details>`;
    }
    case "columns": {
      const cols = b.columns
        .map((col) => `<div style="flex:1 1 0;min-width:0">${col.map(renderBlock).join("")}</div>`)
        .join("");
      return `<div style="display:flex;gap:1.25rem;flex-wrap:wrap;margin:0 0 1em">${cols}</div>`;
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
      const langClass = ` class="language-${escapeAttr(b.lang)}"`;
      return `<pre><code${langClass}>${escapeHtml(b.code)}</code></pre>`;
    }
    case "math": {
      // Rendered as source, not compiled via KaTeX — a compiled render
      // needs KaTeX's CSS (including @font-face declarations) shipped
      // alongside it to display correctly, which conflicts with this
      // exporter's "conservative, dependency-free HTML subset" contract
      // (see file header). Same treatment as `diagram` for the same reason.
      return `<pre><code class="language-latex">${escapeHtml(b.code)}</code></pre>`;
    }
    case "footnotes": {
      const items = b.items
        .map((item) => {
          const inner = item.blocks.map(renderBlock).join("");
          return `<li id="fn-${escapeAttr(item.id)}">${inner} <a href="#fnref-${escapeAttr(item.id)}">↩</a></li>`;
        })
        .join("");
      return `<hr /><section aria-label="Footnotes"><ol>${items}</ol></section>`;
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
    case "math":
      return `<code>${escapeHtml(i.v)}</code>`;
    case "footnoteRef":
      return `<sup><a href="#fn-${escapeAttr(i.id)}" id="fnref-${escapeAttr(i.id)}">[${i.n}]</a></sup>`;
    default:
      return "";
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
