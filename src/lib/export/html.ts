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
  // Return a fragment wrapped in a single container for easy pasting.
  return `<div>${inner}</div>`;
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
        .map((it) => `<li>${renderInlines(it)}</li>`)
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
    default:
      // Exhaustive guard for future block types.
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
      // `rel` is good hygiene for copied HTML; harmless in emails/docs.
      return `<a href="${safeHref}" rel="noopener noreferrer">${renderInlines(
        i.c,
      )}</a>`;
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
