import type { Block, Inline } from "@/lib/blocks";

type Wikilink = Extract<Inline, { t: "wikilink" }>;
/** What a wikilink becomes in the stored document. Must not return a wikilink. */
export type ReplaceWikilink = (node: Wikilink) => Inline;

const toText: ReplaceWikilink = (node) => ({ t: "text", v: node.label ?? node.target });

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
export function stripWikilinksFromInlines(inl: Inline[], replace: ReplaceWikilink = toText): Inline[] {
  return inl.map((node): Inline => {
    switch (node.t) {
      case "wikilink":
        return replace(node);
      case "strong":
      case "em":
      case "del":
        return { ...node, c: stripWikilinksFromInlines(node.c, replace) };
      case "link":
        // No link inside a link: a wikilink here is always plain text.
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
 * in a document is neutralized before storage. `replace` decides what each
 * one becomes: plain text by default, or a real link for a title that
 * resolved to a published page (src/server/links.ts). Mirrors the per-kind
 * exhaustiveness already required by `block-schema.ts` and
 * `BlockRenderer.tsx` — a future new Block kind that holds Inline/Block
 * content needs a case here too, the same way it needs one in those files.
 */
export function stripWikilinksFromBlocks(blocks: Block[], replace: ReplaceWikilink = toText): Block[] {
  const inlines = (inl: Inline[]) => stripWikilinksFromInlines(inl, replace);
  const nested = (inner: Block[]) => stripWikilinksFromBlocks(inner, replace);
  return blocks.map((b): Block => {
    switch (b.t) {
      case "heading":
      case "paragraph":
        return { ...b, inl: inlines(b.inl) };

      case "list":
        return {
          ...b,
          items: b.items.map((item) => ({
            ...item,
            inl: inlines(item.inl),
            children: item.children
              ? nested(item.children)
              : item.children,
          })),
        };

      case "quote":
      case "callout":
      case "toggle":
        return { ...b, blocks: nested(b.blocks) };

      case "columns":
        return { ...b, columns: b.columns.map(nested) };

      case "table":
        return {
          ...b,
          head: b.head.map(inlines),
          rows: b.rows.map((row) => row.map(inlines)),
        };

      case "footnotes":
        return {
          ...b,
          items: b.items.map((item) => ({
            ...item,
            blocks: nested(item.blocks),
          })),
        };

      default:
        return b;
    }
  });
}
