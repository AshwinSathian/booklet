import type { Inline } from "./blocks";

/**
 * Flattens Inline[] to plain text — shared by the TOC (heading titles) and
 * reading-time estimate (word counts), which each used to hand-roll their
 * own version of this. reading-time's version in particular had a real bug:
 * it recursed into nested marks (strong/em/del/link) for a word *count*,
 * then joined that count's digits back in as if it were the text itself —
 * `**two words**` was undercounted as a single token ("2") rather than two.
 * Flattening to actual text first, then counting words once at the end,
 * fixes that by construction.
 */
export function inlineToPlainText(inl: Inline[] | Inline | undefined): string {
  if (!inl) return "";
  if (Array.isArray(inl)) return inl.map(inlineToPlainText).join("");

  switch (inl.t) {
    case "text":
    case "code":
      return inl.v;
    case "link":
    case "strong":
    case "em":
    case "del":
      return inlineToPlainText(inl.c);
    case "image":
      return inl.alt;
    case "math":
    case "footnoteRef":
      return "";
    default:
      return "";
  }
}
