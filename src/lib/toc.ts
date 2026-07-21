import { containerChildGroups, type Block, type Inline } from "@/lib/blocks";

export type TocItem = {
  id: string;
  text: string;
  level: 1 | 2 | 3;
};

export const MIN_TOC_HEADINGS = 3;

function inlineToText(inl: Inline[] | Inline | unknown): string {
  if (!inl) return "";
  if (Array.isArray(inl)) return inl.map(inlineToText).join("");
  if (typeof inl === "string") return inl;
  if (typeof inl !== "object") return "";

  const node = inl as Inline;
  switch (node.t) {
    case "text":
    case "code":
      return node.v;
    case "link":
      return inlineToText(node.c);
    case "strong":
    case "em":
    case "del":
      return inlineToText(node.c);
    case "image":
      return node.alt;
    default:
      return "";
  }
}

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

  function walk(list: Block[], path: number[]) {
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const key = [...path, i].join(".");

      if (
        b.t === "heading" &&
        (b.level === 1 || b.level === 2 || b.level === 3)
      ) {
        const text = clampText(inlineToText(b.inl));
        const anchorId = nextAnchorId(text || "section");
        toc.push({ id: anchorId, text: text || "Section", level: b.level });
        anchorMap[key] = anchorId;
      }

      const groups = containerChildGroups(b);
      if (groups) {
        // Single-group containers (quote, and later callout/toggle) keep the
        // exact same path shape as before this change (no extra path
        // segment) — this is what makes the refactor behavior-identical for
        // `quote`. Multi-group containers (later: columns) get one extra
        // path segment per group so keys stay unique across columns and
        // match the keyPrefix each column's own BlockRenderer call will use.
        groups.forEach((group, gi) => {
          walk(group, groups.length > 1 ? [...path, i, gi] : [...path, i]);
        });
      }
    }
  }

  walk(blocks ?? [], []);

  return { toc, anchorMap };
}
