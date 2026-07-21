import { test, expect } from "@playwright/test";
import { parseToBlocks } from "@/lib/parse";
import type { Block } from "@/lib/blocks";

// Phase 2 of PLAN-rich-markdown-blocks.md: `> [!KIND]` blockquote-marker
// callout syntax (GitHub/Obsidian convention). Unrecognized markers must
// fall back to a plain quote so the syntax degrades gracefully.

function firstBlock(md: string): Block {
  const blocks = parseToBlocks(md);
  expect(blocks.length).toBeGreaterThan(0);
  return blocks[0];
}

test.describe("callout parsing", () => {
  for (const kind of ["note", "tip", "warning", "important", "caution"] as const) {
    test(`> [!${kind.toUpperCase()}] on its own line becomes a callout`, () => {
      const b = firstBlock(`> [!${kind.toUpperCase()}]\n> Body text here.`);
      expect(b.t).toBe("callout");
      if (b.t === "callout") {
        expect(b.kind).toBe(kind);
        expect(b.blocks).toHaveLength(1);
        expect(b.blocks[0]).toEqual({
          t: "paragraph",
          inl: [{ t: "text", v: "Body text here." }],
        });
      }
    });
  }

  test("marker is case-insensitive", () => {
    const b = firstBlock("> [!NoTe]\n> hi");
    expect(b.t).toBe("callout");
    if (b.t === "callout") expect(b.kind).toBe("note");
  });

  test("inline content on the same line as the marker is preserved", () => {
    const b = firstBlock("> [!TIP] Use the API key from settings.");
    expect(b.t).toBe("callout");
    if (b.t === "callout") {
      expect(b.blocks).toHaveLength(1);
      expect(b.blocks[0]).toEqual({
        t: "paragraph",
        inl: [{ t: "text", v: "Use the API key from settings." }],
      });
    }
  });

  test("marker with no body at all still becomes an (empty-body) callout", () => {
    const b = firstBlock("> [!WARNING]");
    expect(b.t).toBe("callout");
    if (b.t === "callout") {
      expect(b.kind).toBe("warning");
      expect(b.blocks).toEqual([]);
    }
  });

  test("an unrecognized marker falls back to a plain quote", () => {
    const b = firstBlock("> [!BOGUS]\n> still just a quote");
    expect(b.t).toBe("quote");
  });

  test("a plain blockquote with no marker is unaffected", () => {
    const b = firstBlock("> Just a regular quote.");
    expect(b.t).toBe("quote");
    if (b.t === "quote") {
      expect(b.blocks[0]).toEqual({
        t: "paragraph",
        inl: [{ t: "text", v: "Just a regular quote." }],
      });
    }
  });

  test("multiple paragraphs after the marker are all kept in the callout body", () => {
    const b = firstBlock("> [!NOTE]\n> First paragraph.\n>\n> Second paragraph.");
    expect(b.t).toBe("callout");
    if (b.t === "callout") {
      expect(b.blocks).toHaveLength(2);
      expect(b.blocks[0]).toEqual({ t: "paragraph", inl: [{ t: "text", v: "First paragraph." }] });
      expect(b.blocks[1]).toEqual({ t: "paragraph", inl: [{ t: "text", v: "Second paragraph." }] });
    }
  });

  test("a heading following the marker line is preserved as its own block", () => {
    const b = firstBlock("> [!NOTE]\n> # Heading\n> body");
    expect(b.t).toBe("callout");
    if (b.t === "callout") {
      expect(b.blocks[0].t).toBe("heading");
    }
  });

  test("a callout nested inside a list item is detected", () => {
    const blocks = parseToBlocks("- item\n\n  > [!TIP]\n  > nested tip");
    expect(blocks).toHaveLength(1);
    const list = blocks[0];
    expect(list.t).toBe("list");
    if (list.t === "list") {
      const nested = list.items[0].children?.[0];
      expect(nested?.t).toBe("callout");
    }
  });

  test("raw HTML is still stripped (unrelated regression check)", () => {
    const blocks = parseToBlocks("<script>alert(1)</script>\n\nHello");
    expect(blocks).toEqual([{ t: "paragraph", inl: [{ t: "text", v: "Hello" }] }]);
  });
});

// Phase 3: :::toggle / :::columns container directives (remark-directive).

test.describe("toggle directive parsing", () => {
  test(":::toggle[Summary] ... ::: becomes a toggle block with that summary", () => {
    const b = firstBlock(":::toggle[Click to expand]\nHidden body text.\n:::");
    expect(b.t).toBe("toggle");
    if (b.t === "toggle") {
      expect(b.summary).toBe("Click to expand");
      expect(b.blocks).toEqual([{ t: "paragraph", inl: [{ t: "text", v: "Hidden body text." }] }]);
    }
  });

  test("a toggle with no label falls back to a default summary", () => {
    const b = firstBlock(":::toggle\nbody\n:::");
    expect(b.t).toBe("toggle");
    if (b.t === "toggle") expect(b.summary).toBe("Details");
  });

  test("a toggle can contain multiple blocks, including a heading", () => {
    const b = firstBlock(":::toggle[More]\n# Nested Heading\n\nSome text.\n:::");
    expect(b.t).toBe("toggle");
    if (b.t === "toggle") {
      expect(b.blocks).toHaveLength(2);
      expect(b.blocks[0].t).toBe("heading");
    }
  });

  test("a toggle can nest inside a callout", () => {
    const b = firstBlock("> [!NOTE]\n> :::toggle[Details]\n> nested\n> :::");
    expect(b.t).toBe("callout");
    if (b.t === "callout") {
      expect(b.blocks[0].t).toBe("toggle");
    }
  });
});

test.describe("columns directive parsing", () => {
  test("two groups separated by --- become a 2-column block", () => {
    const b = firstBlock(":::columns\nLeft side.\n\n---\n\nRight side.\n:::");
    expect(b.t).toBe("columns");
    if (b.t === "columns") {
      expect(b.columns).toHaveLength(2);
      expect(b.columns[0]).toEqual([{ t: "paragraph", inl: [{ t: "text", v: "Left side." }] }]);
      expect(b.columns[1]).toEqual([{ t: "paragraph", inl: [{ t: "text", v: "Right side." }] }]);
    }
  });

  test("a single group (no separator) falls back to unwrapped content, not a columns block", () => {
    const blocks = parseToBlocks(":::columns\nJust one thing.\n:::");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ t: "paragraph", inl: [{ t: "text", v: "Just one thing." }] });
  });

  test("more than 4 groups are capped at 4 columns, with overflow folded into the last", () => {
    const md = ":::columns\nA\n\n---\n\nB\n\n---\n\nC\n\n---\n\nD\n\n---\n\nE\n:::";
    const b = firstBlock(md);
    expect(b.t).toBe("columns");
    if (b.t === "columns") {
      expect(b.columns).toHaveLength(4);
      // Last column folds in both the 4th and 5th groups' content.
      expect(b.columns[3]).toHaveLength(2);
    }
  });

  test("an unrecognized directive name is dropped, not left as an error node", () => {
    const blocks = parseToBlocks(":::mystery\nshould vanish\n:::\n\nStill here.");
    expect(blocks).toEqual([{ t: "paragraph", inl: [{ t: "text", v: "Still here." }] }]);
  });
});

test.describe("Phase 4: graphviz/dot fenced blocks route to the diagram block type", () => {
  for (const lang of ["dot", "graphviz"]) {
    test(`\`\`\`${lang} becomes a diagram block, not a plain code block`, () => {
      const b = firstBlock(`\`\`\`${lang}\ndigraph { a -> b }\n\`\`\``);
      expect(b.t).toBe("diagram");
      if (b.t === "diagram") {
        expect(b.lang).toBe(lang);
        expect(b.code).toBe("digraph { a -> b }");
      }
    });
  }
});
