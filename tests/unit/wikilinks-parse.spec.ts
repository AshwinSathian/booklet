import { test, expect } from "@playwright/test";
import { parseToBlocks } from "@/lib/parse";
import { stripWikilinksFromBlocks } from "@/lib/wikilinks/strip";
import { extractWikilinkTargets } from "@/lib/wikilinks/parse";
import type { Block, Inline } from "@/lib/blocks";

// Milestone 1 of PLAN-obsidian-parity.md: private `[[wikilink]]` inlines.
// `[[...]]` never forms a valid CommonMark link/reference, so it survives
// remark-parse as literal text and is detected by regex post-processing
// (src/lib/wikilinks/parse.ts), the same style already used for the
// `> [!NOTE]` callout marker (tests/unit/parse-blocks.spec.ts).

function firstParagraphInlines(md: string): Inline[] {
  const blocks = parseToBlocks(md);
  expect(blocks.length).toBeGreaterThan(0);
  const b = blocks[0];
  expect(b.t).toBe("paragraph");
  return b.t === "paragraph" ? b.inl : [];
}

test.describe("wikilink parsing", () => {
  test("plain [[Target]] becomes a wikilink inline with no label", () => {
    const inl = firstParagraphInlines("See [[My Draft]] for details.");
    expect(inl).toContainEqual({ t: "wikilink", target: "My Draft", label: undefined });
  });

  test("[[Target|Label]] captures a custom display label", () => {
    const inl = firstParagraphInlines("See [[my-draft|My Draft]] for details.");
    expect(inl).toContainEqual({ t: "wikilink", target: "my-draft", label: "My Draft" });
  });

  test("target and label are trimmed", () => {
    const inl = firstParagraphInlines("[[ Spacey Title | Spacey Label ]]");
    expect(inl).toContainEqual({ t: "wikilink", target: "Spacey Title", label: "Spacey Label" });
  });

  test("text surrounding a wikilink is preserved", () => {
    const inl = firstParagraphInlines("Before [[Target]] after.");
    expect(inl).toEqual([
      { t: "text", v: "Before " },
      { t: "wikilink", target: "Target", label: undefined },
      { t: "text", v: " after." },
    ]);
  });

  test("multiple wikilinks in one paragraph are all detected", () => {
    const inl = firstParagraphInlines("[[A]] and [[B]]");
    const wikilinks = inl.filter((n) => n.t === "wikilink");
    expect(wikilinks).toEqual([
      { t: "wikilink", target: "A", label: undefined },
      { t: "wikilink", target: "B", label: undefined },
    ]);
  });

  test("a wikilink nested inside emphasis/strong is still detected", () => {
    const inl = firstParagraphInlines("**[[Target]]**");
    expect(inl).toHaveLength(1);
    expect(inl[0].t).toBe("strong");
    if (inl[0].t === "strong") {
      expect(inl[0].c).toContainEqual({ t: "wikilink", target: "Target", label: undefined });
    }
  });

  test("an unclosed [[ with no matching ]] stays literal text", () => {
    const inl = firstParagraphInlines("This has [[ no closing brackets.");
    expect(inl).toEqual([{ t: "text", v: "This has [[ no closing brackets." }]);
  });

  test("empty [[]] is not treated as a wikilink", () => {
    const inl = firstParagraphInlines("Nothing here: [[]]");
    expect(inl.some((n) => n.t === "wikilink")).toBe(false);
  });

  test("a wikilink never appears inside a heading's own separate parse without regression", () => {
    // Headings share the same inlineFromNodes path — sanity check it also works there.
    const blocks = parseToBlocks("# [[Heading Target]]");
    expect(blocks[0].t).toBe("heading");
    if (blocks[0].t === "heading") {
      expect(blocks[0].inl).toContainEqual({ t: "wikilink", target: "Heading Target", label: undefined });
    }
  });
});

test.describe("extractWikilinkTargets", () => {
  test("collects distinct targets from raw markdown", () => {
    const targets = extractWikilinkTargets("[[Alpha]] and [[Beta|Nice Label]] and [[Alpha]] again");
    expect(targets.sort()).toEqual(["Alpha", "Beta"]);
  });

  test("returns an empty array when there are no wikilinks", () => {
    expect(extractWikilinkTargets("Just plain markdown, no brackets.")).toEqual([]);
  });
});

test.describe("stripWikilinksFromBlocks", () => {
  function paragraph(inl: Inline[]): Block {
    return { t: "paragraph", inl };
  }

  test("converts a wikilink to plain text using its label when present", () => {
    const blocks: Block[] = [
      paragraph([
        { t: "text", v: "See " },
        { t: "wikilink", target: "target-slug", label: "Nice Label" },
        { t: "text", v: "." },
      ]),
    ];
    const stripped = stripWikilinksFromBlocks(blocks);
    expect(stripped).toEqual([
      paragraph([
        { t: "text", v: "See " },
        { t: "text", v: "Nice Label" },
        { t: "text", v: "." },
      ]),
    ]);
  });

  test("falls back to the target when there's no label", () => {
    const blocks: Block[] = [paragraph([{ t: "wikilink", target: "Some Draft" }])];
    expect(stripWikilinksFromBlocks(blocks)).toEqual([paragraph([{ t: "text", v: "Some Draft" }])]);
  });

  test("strips a wikilink nested inside a list item's children and a table cell", () => {
    const blocks: Block[] = [
      {
        t: "list",
        ordered: false,
        items: [
          {
            inl: [{ t: "wikilink", target: "Item Target" }],
            children: [paragraph([{ t: "wikilink", target: "Nested Target" }])],
          },
        ],
      },
      {
        t: "table",
        head: [[{ t: "wikilink", target: "Head Target" }]],
        rows: [[[{ t: "wikilink", target: "Cell Target" }]]],
        align: [null],
      },
    ];

    const stripped = stripWikilinksFromBlocks(blocks);
    const list = stripped[0];
    expect(list.t).toBe("list");
    if (list.t === "list") {
      expect(list.items[0].inl).toEqual([{ t: "text", v: "Item Target" }]);
      expect(list.items[0].children?.[0]).toEqual(paragraph([{ t: "text", v: "Nested Target" }]));
    }

    const table = stripped[1];
    expect(table.t).toBe("table");
    if (table.t === "table") {
      expect(table.head).toEqual([[{ t: "text", v: "Head Target" }]]);
      expect(table.rows).toEqual([[[{ t: "text", v: "Cell Target" }]]]);
    }
  });

  test("a document with no wikilinks is returned unchanged in shape", () => {
    const blocks: Block[] = [paragraph([{ t: "text", v: "Nothing special here." }])];
    expect(stripWikilinksFromBlocks(blocks)).toEqual(blocks);
  });

  test("end to end: parseToBlocks + stripWikilinksFromBlocks never leaves a wikilink node", () => {
    const blocks = stripWikilinksFromBlocks(
      parseToBlocks("# [[Heading Link]]\n\nSee [[Body Link|Label]] and **[[Nested]]**."),
    );

    function hasWikilink(bs: Block[]): boolean {
      return bs.some((b) => {
        if (b.t === "paragraph" || b.t === "heading") return inlHasWikilink(b.inl);
        return false;
      });
    }
    function inlHasWikilink(inl: Inline[]): boolean {
      return inl.some((n) => n.t === "wikilink" || ("c" in n && inlHasWikilink(n.c)));
    }

    expect(hasWikilink(blocks)).toBe(false);
  });
});
