import { containerChildGroups, type Block } from "./blocks";

/**
 * Single shared recursive walker for `Block[]` trees. Before this existed,
 * every consumer that needed to visit nested content (src/lib/toc.ts,
 * src/lib/reading-time.ts, src/lib/block-usage.ts) hand-rolled its own
 * `containerChildGroups`-aware recursion — each one an independent place a
 * future container kind could be forgotten (as happened historically with
 * toc.ts, which only recursed into `quote` until the rich-blocks work
 * generalized it). Centralizing the walk here means a new container kind is
 * wired into every consumer the moment it's added to `containerChildGroups`.
 *
 * `visit` returning `false` stops descent into that block's children
 * (the caller has already handled them, or intentionally wants to skip
 * them) without affecting traversal of siblings.
 */
export function walkBlocks(
  blocks: Block[],
  visit: (block: Block, path: number[]) => void | false,
  path: number[] = [],
): void {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const childPath = [...path, i];
    const descend = visit(block, childPath);
    if (descend === false) continue;

    if (block.t === "list") {
      for (let j = 0; j < block.items.length; j++) {
        const children = block.items[j].children;
        if (children?.length) walkBlocks(children, visit, [...childPath, j]);
      }
      continue;
    }

    const groups = containerChildGroups(block);
    if (groups) {
      // Path shape must mirror BlockRenderer's own `keyPrefix` scheme
      // (src/components/blocks/BlockRenderer.tsx) exactly, since buildToc's
      // anchorMap is keyed by this path and looked up via that same
      // `keyPrefix` at render time. A single-group container (quote,
      // callout, toggle) reuses the container's own key verbatim — no group
      // index segment; only a multi-group container (columns) adds one per
      // column, matching `Columns.tsx`'s `keyPrefix={`${keyPrefix}.${i}`}`.
      for (let g = 0; g < groups.length; g++) {
        walkBlocks(groups[g], visit, groups.length > 1 ? [...childPath, g] : childPath);
      }
    }
  }
}
