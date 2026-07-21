import { test, expect } from "@playwright/test";
import { readingTimeMinutes } from "@/lib/reading-time";
import type { Block } from "@/lib/blocks";

// Core-engine rework: the previous implementation counted words inside a
// nested mark (strong/em/del/link) by recursing for a word *count*, then
// joining that count's digits back into the outer text as if it were
// content — `**two words**` got counted as a single token ("2") instead of
// two. readingTimeMinutes now flattens to plain text first (inlineToPlainText,
// shared with toc.ts) and counts once, which fixes this by construction.

function words(n: number): Block[] {
  return [{ t: "paragraph", inl: [{ t: "text", v: Array(n).fill("word").join(" ") }] }];
}

test.describe("readingTimeMinutes", () => {
  test("~200 words rounds to 1 minute", () => {
    expect(readingTimeMinutes(words(200))).toBe(1);
  });

  test("~1000 words rounds to 5 minutes", () => {
    expect(readingTimeMinutes(words(1000))).toBe(5);
  });

  test("an empty document is still at least 1 minute", () => {
    expect(readingTimeMinutes([])).toBe(1);
  });

  test("words inside a nested mark count individually, not as a collapsed digit", () => {
    const withMark: Block[] = [
      { t: "paragraph", inl: [{ t: "strong", c: [{ t: "text", v: Array(200).fill("word").join(" ") }] }] },
    ];
    // Before the fix, 200 words wrapped in **strong** would undercount to a
    // single "word" (the stringified nested count, "200") and round to 1
    // minute regardless of actual length. It must match the unwrapped case.
    expect(readingTimeMinutes(withMark)).toBe(readingTimeMinutes(words(200)));
  });

  test("counts words nested inside lists, quotes, callouts, and footnotes (container-aware via walkBlocks)", () => {
    const blocks: Block[] = [
      { t: "list", ordered: false, items: [{ inl: [{ t: "text", v: Array(50).fill("w").join(" ") }] }] },
      { t: "quote", blocks: words(50) },
      { t: "callout", kind: "note", blocks: words(50) },
      { t: "footnotes", items: [{ id: "1", n: 1, blocks: words(50) }] },
    ];
    expect(readingTimeMinutes(blocks)).toBe(1); // 200 words / 200wpm = 1
  });

  test("code/hr/image/diagram contribute nothing", () => {
    const blocks: Block[] = [
      { t: "code", code: Array(500).fill("word").join(" "), lang: "text" },
      { t: "hr" },
      { t: "image", src: "https://example.com/a.png", alt: Array(50).fill("word").join(" ") },
      { t: "diagram", lang: "mermaid", code: "graph TD; A-->B;" },
    ];
    expect(readingTimeMinutes(blocks)).toBe(1); // floors to the 1-minute minimum, not inflated by code/alt text
  });
});
