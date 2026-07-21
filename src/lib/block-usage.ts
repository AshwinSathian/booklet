import { containerChildGroups, RICH_BLOCK_KINDS, type Block } from "./blocks";

/**
 * Returns the distinct "rich block" kinds (see RICH_BLOCK_KINDS in ./blocks)
 * present anywhere in a document, including nested inside other containers.
 * Recorded alongside each publish event so adoption of the new syntax is
 * measurable — per PLAN-rich-markdown-blocks.md, further phases (e.g. stat/
 * dashboard blocks) are gated on this data, not on the essay that prompted
 * the effort.
 */
export function collectRichBlockKinds(blocks: Block[]): string[] {
  const found = new Set<string>();

  function walk(list: Block[]) {
    for (const b of list) {
      if (RICH_BLOCK_KINDS.has(b.t)) found.add(b.t);
      const groups = containerChildGroups(b);
      if (groups) groups.forEach(walk);
    }
  }

  walk(blocks ?? []);
  return Array.from(found).sort();
}
