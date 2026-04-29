import type { Block, Inline, ListItem } from "./blocks";

function inlineWords(inl: Inline[]): number {
  const text = inl
    .map((n): string => {
      if (n.t === "text" || n.t === "code") return n.v;
      if (n.t === "link" || n.t === "strong" || n.t === "em" || n.t === "del")
        return inlineWords(n.c as Inline[]).toString();
      return "";
    })
    .join(" ");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function listItemWords(item: ListItem): number {
  return (
    inlineWords(item.inl ?? []) +
    blockWords(item.children ?? [])
  );
}

function blockWords(blocks: Block[]): number {
  let count = 0;
  for (const b of blocks ?? []) {
    if (b.t === "heading" || b.t === "paragraph") {
      count += inlineWords(b.inl);
    } else if (b.t === "list") {
      for (const item of b.items) count += listItemWords(item);
    } else if (b.t === "quote") {
      count += blockWords(b.blocks);
    }
    // code, table, hr, image, diagram — not counted as reading content
  }
  return count;
}

export function readingTimeMinutes(blocks: Block[]): number {
  const words = blockWords(blocks);
  return Math.max(1, Math.round(words / 200));
}
