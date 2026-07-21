import { walkBlocks } from "./block-tree";
import type { Block } from "./blocks";
import { inlineToPlainText } from "./inline-text";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Words are only counted directly on `heading`/`paragraph`/table-cell text;
 * walkBlocks already recurses into every container (list items, quotes,
 * callouts, toggles, columns, footnotes), so nested prose is reached without
 * this function recursing itself. code/hr/image/diagram/math contribute
 * nothing — consistent with the pre-existing behavior of not counting code
 * toward reading time.
 */
export function readingTimeMinutes(blocks: Block[]): number {
  let words = 0;

  walkBlocks(blocks ?? [], (b) => {
    if (b.t === "heading" || b.t === "paragraph") {
      words += wordCount(inlineToPlainText(b.inl));
    } else if (b.t === "list") {
      for (const item of b.items) words += wordCount(inlineToPlainText(item.inl));
    } else if (b.t === "table") {
      for (const cell of b.head) words += wordCount(inlineToPlainText(cell));
      for (const row of b.rows) for (const cell of row) words += wordCount(inlineToPlainText(cell));
    }
  });

  return Math.max(1, Math.round(words / 200));
}
