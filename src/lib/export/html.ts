import type { Block, Inline } from "@/lib/blocks";
import { parseToBlocks } from "@/lib/parse";
import { normalizeInput, stripDangerousSequences } from "@/lib/sanitize";

/**
 * Convert the app's markdown (source of truth) into a clean HTML fragment.
 *
 * We intentionally:
 * - Reuse the existing markdown → block parser (to stay close to preview semantics)
 * - Generate a conservative, semantic HTML subset (email/doc friendly)
 * - Escape all user strings and defensively sanitize URLs
 */
export function markdownToHtml(raw: string): string {
  const normalized = stripDangerousSequences(normalizeInput(raw ?? ""));

  let blocks: Block[] = [];
  if (normalized.trim()) {
    try {
      blocks = parseToBlocks(normalized);
    } catch {
      blocks = [];
    }
  }

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
          // Backwards compat: old published docs stored items as Inline[]
          if (Array.isArray(it)) return `<li>${renderInlines(it as never)}</li>`;
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
    case "code": {
      const langClass = b.lang ? ` class="language-${escapeAttr(b.lang)}"` : "";
      return `<pre><code${langClass}>${escapeHtml(b.code)}</code></pre>`;
    }
    case "table": {
      const headCells = b.head
        .map((cell) => `<th>${renderInlines(cell)}</th>`)
        .join("");
      const head = `<thead><tr>${headCells}</tr></thead>`;

      const bodyRows = b.rows
        .map((row) => {
          const tds = row
            .map((cell) => `<td>${renderInlines(cell)}</td>`)
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
      const safeSrc = sanitizeHref(b.src);
      if (!safeSrc || safeSrc === "#") return "";
      return `<figure><img src="${escapeAttr(safeSrc)}" alt="${escapeAttr(b.alt)}" />${b.alt ? `<figcaption>${escapeHtml(b.alt)}</figcaption>` : ""}</figure>`;
    }
    case "diagram": {
      const langClass = ` class="language-${escapeAttr(b.lang)}"`;
      return `<pre><code${langClass}>${escapeHtml(b.code)}</code></pre>`;
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
      const href = sanitizeHref(i.href);
      const safeHref = escapeAttr(href);
      return `<a href="${safeHref}" rel="noopener noreferrer">${renderInlines(i.c)}</a>`;
    }
    case "del":
      return `<del>${renderInlines(i.c)}</del>`;
    case "image": {
      const safeSrc = sanitizeHref(i.src);
      if (!safeSrc || safeSrc === "#") return "";
      return `<img src="${escapeAttr(safeSrc)}" alt="${escapeAttr(i.alt)}" />`;
    }
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

function sanitizeHref(href: string): string {
  const raw = (href ?? "").trim();
  if (!raw) return "#";

  // Disallow javascript/data/vbscript and other odd schemes.
  const lowered = raw.toLowerCase();
  if (
    lowered.startsWith("javascript:") ||
    lowered.startsWith("data:") ||
    lowered.startsWith("vbscript:")
  ) {
    return "#";
  }

  // Allow common safe URL shapes.
  if (
    lowered.startsWith("http://") ||
    lowered.startsWith("https://") ||
    lowered.startsWith("mailto:") ||
    lowered.startsWith("#") ||
    lowered.startsWith("/") ||
    lowered.startsWith("./") ||
    lowered.startsWith("../")
  ) {
    return raw;
  }

  // Anything else becomes inert.
  return "#";
}

function clampHeadingLevel(level: number): 1 | 2 | 3 | 4 {
  if (level <= 1) return 1;
  if (level === 2) return 2;
  if (level === 3) return 3;
  return 4;
}
