import { walkBlocks } from "./block-tree";
import { RICH_BLOCK_KINDS, type Block } from "./blocks";

/**
 * Returns the distinct "rich block" kinds (see RICH_BLOCK_KINDS in ./blocks)
 * present anywhere in a document, including nested inside other containers
 * and inside list items. Recorded alongside each publish event so adoption
 * of the new syntax is measurable — per PLAN-rich-markdown-blocks.md,
 * further phases (e.g. stat/dashboard blocks) are gated on this data, not on
 * the essay that prompted the effort.
 */
export function collectRichBlockKinds(blocks: Block[]): string[] {
  const found = new Set<string>();

  walkBlocks(blocks ?? [], (b) => {
    if (RICH_BLOCK_KINDS.has(b.t)) found.add(b.t);
  });

  return Array.from(found).sort();
}
