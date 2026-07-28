import type { Block, Inline } from "@/lib/blocks";

/**
 * Converts `wikilink` inlines to plain text (`label ?? target`, no
 * brackets). Called on every publish/patch route's parsed `Block[]` before
 * `validateBlocks`/storage — see src/lib/blocks.ts's `Inline` doc comment
 * for why this must run unconditionally on every path that persists blocks.
 *
 * Recurses into every inline container kind (strong/em/del/link) exactly
 * the way src/lib/parse.ts's own `inlineFromNodes` does, so a wikilink
 * nested inside emphasis or a real link is still caught.
 */
export function stripWikilinksFromInlines(inl: Inline[]): Inline[] {
  return inl.map((node): Inline => {
    switch (node.t) {
      case "wikilink":
        return { t: "text", v: node.label ?? node.target };
      case "strong":
      case "em":
      case "del":
        return { ...node, c: stripWikilinksFromInlines(node.c) };
      case "link":
        return { ...node, c: stripWikilinksFromInlines(node.c) };
      default:
        return node;
    }
  });
}

/**
 * Recurses through every `Block` kind that can carry `Inline[]` (directly,
 * via `ListItem.inl`, or via table head/rows) or nested `Block[]` (list item
 * children, quote/callout/toggle/columns/footnotes) so a wikilink anywhere
 * in a document is neutralized before storage. Mirrors the per-kind
 * exhaustiveness already required by `block-schema.ts` and
 * `BlockRenderer.tsx` — a future new Block kind that holds Inline/Block
 * content needs a case here too, the same way it needs one in those files.
 */
export function stripWikilinksFromBlocks(blocks: Block[]): Block[] {
  return blocks.map((b): Block => {
    switch (b.t) {
      case "heading":
      case "paragraph":
        return { ...b, inl: stripWikilinksFromInlines(b.inl) };

      case "list":
        return {
          ...b,
          items: b.items.map((item) => ({
            ...item,
            inl: stripWikilinksFromInlines(item.inl),
            children: item.children
              ? stripWikilinksFromBlocks(item.children)
              : item.children,
          })),
        };

      case "quote":
      case "callout":
      case "toggle":
        return { ...b, blocks: stripWikilinksFromBlocks(b.blocks) };

      case "columns":
        return { ...b, columns: b.columns.map(stripWikilinksFromBlocks) };

      case "table":
        return {
          ...b,
          head: b.head.map(stripWikilinksFromInlines),
          rows: b.rows.map((row) => row.map(stripWikilinksFromInlines)),
        };

      case "footnotes":
        return {
          ...b,
          items: b.items.map((item) => ({
            ...item,
            blocks: stripWikilinksFromBlocks(item.blocks),
          })),
        };

      default:
        return b;
    }
  });
}
