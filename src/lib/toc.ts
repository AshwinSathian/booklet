import { walkBlocks } from "@/lib/block-tree";
import type { Block } from "@/lib/blocks";
import { inlineToPlainText } from "@/lib/inline-text";

export type TocItem = {
  id: string;
  text: string;
  level: 1 | 2 | 3;
};

export const MIN_TOC_HEADINGS = 3;

/**
 * Best-effort slugging without external deps.
 * - deterministic
 * - de-dupes by appending -2, -3, ...
 * - handles non-ASCII reasonably (keeps unicode letters/numbers)
 */
function slugify(raw: string): string {
  const s = raw
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return s || "section";
}

function clampText(s: string, max = 120): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

export function buildToc(blocks: Block[]): {
  toc: TocItem[];
  anchorMap: Record<string, string>;
} {
  const toc: TocItem[] = [];
  const anchorMap: Record<string, string> = {};

  const seen: Record<string, number> = {};

  function nextAnchorId(baseText: string): string {
    const base = slugify(baseText);
    const n = (seen[base] ?? 0) + 1;
    seen[base] = n;
    return n === 1 ? base : `${base}-${n}`;
  }

  walkBlocks(blocks ?? [], (b, path) => {
    if (b.t === "heading" && (b.level === 1 || b.level === 2 || b.level === 3)) {
      const text = clampText(inlineToPlainText(b.inl));
      const anchorId = nextAnchorId(text || "section");
      toc.push({ id: anchorId, text: text || "Section", level: b.level });
      anchorMap[path.join(".")] = anchorId;
    }
  });

  return { toc, anchorMap };
}
