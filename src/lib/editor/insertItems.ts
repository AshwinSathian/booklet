import type { IconName } from "@/components/ui/Icon";
import { CALLOUT_KINDS, type CalloutKind } from "@/lib/blocks";

/**
 * A literal Markdown snippet to insert at the cursor, plus where to leave
 * the selection afterward — e.g. the table snippet selects its "Column 1"
 * placeholder so typing immediately replaces it, mirroring
 * PasteInput.tsx's existing `insertTable()` behavior. Both `selectFrom` and
 * `selectTo` default to `text.length` (cursor placed at the end, nothing
 * selected) when omitted.
 */
export type InsertSnippet = {
  text: string;
  selectFrom?: number;
  selectTo?: number;
  /**
   * True when `text` only parses as valid Markdown if it starts on its own
   * line, separated from surrounding content by a blank line — e.g. `---\n`
   * spliced into the middle of a sentence produces `"Existing text.---\n"`,
   * a single garbled line, instead of a real divider. PasteInput.tsx's
   * insertSnippet() uses this to insert leading/trailing blank lines as
   * needed (see normalizeBlockInsertion below), mirroring the pre-existing
   * insertTable() toolbar behavior it was modeled on. When the caret is
   * already at a suitable spot (start of an empty line, etc.) no extra
   * newlines are added, so marking an item `block: true` never changes
   * behavior for the already-correct common case — only the previously
   * broken mid-line case.
   *
   * Every item below is block-level: the five callouts/toggle/columns/
   * table/codeblock/divider are obviously so (multi-line or self-contained
   * constructs), but h1/h2/h3/quote/bullet/ordered/task are exactly as
   * line-start-dependent — `"Existing text.# "` is no more a heading than
   * `"Existing text.---\n"` is a divider, since ATX headings, blockquotes,
   * and list markers are only recognized at the start of a line. So all of
   * them get `block: true` too, not just the "obviously block" subset.
   */
  block?: boolean;
};

/**
 * Wraps a block-level snippet with leading/trailing blank lines as needed so
 * it always lands on its own line(s), regardless of where the caret was.
 * `before`/`after` are the document text immediately preceding/following the
 * insertion point. Generalizes PasteInput.tsx's original insertTable() logic
 * (now itself built on this helper) to any block-level insertion.
 *
 * Returns the padded insertion text plus `leadingOffset` — the number of
 * characters prepended (0 or 2, for "\n\n") — so callers can shift any
 * cursor-placement math (e.g. `selectFrom`) by the same amount, exactly as
 * insertTable already shifted its `firstCellStart` by `headerOffset`.
 */
export function normalizeBlockInsertion(
  before: string,
  after: string,
  text: string,
): { insertion: string; leadingOffset: number } {
  const needsLeadingNewline = before.length > 0 && !before.endsWith("\n");
  const needsTrailingNewline = after.length > 0 && !after.startsWith("\n");
  const leadingOffset = needsLeadingNewline ? 2 : 0;
  const insertion =
    (needsLeadingNewline ? "\n\n" : "") + text + (needsTrailingNewline ? "\n\n" : "");
  return { insertion, leadingOffset };
}

/**
 * One entry in the "/" slash menu and the command palette's Insert group —
 * a single shared definition so both surfaces always agree on what
 * inserting "Callout: Warning" actually produces.
 */
export type InsertItem = {
  id: string;
  label: string;
  keywords: string[];
  icon: IconName;
  /** Short text glyph (e.g. "H1") shown instead of `icon`, matching
   * FormatToolbar's existing H1/H2/H3 text-label style. */
  textGlyph?: string;
  snippet: InsertSnippet;
};

const CALLOUT_LABELS: Record<CalloutKind, string> = {
  note: "Callout: Note",
  tip: "Callout: Tip",
  warning: "Callout: Warning",
  important: "Callout: Important",
  caution: "Callout: Caution",
};

function calloutSnippet(kind: CalloutKind): InsertSnippet {
  const text = `> [!${kind}]\n> `;
  return { text, selectFrom: text.length, block: true };
}

export const TABLE_SNIPPET_TEXT =
  "| Column 1 | Column 2 | Column 3 |\n" +
  "| --- | --- | --- |\n" +
  "| Cell | Cell | Cell |\n" +
  "| Cell | Cell | Cell |";

export const INSERT_ITEMS: InsertItem[] = [
  { id: "h1", label: "Heading 1", keywords: ["heading", "h1", "title"], icon: "markdown", textGlyph: "H1", snippet: { text: "# ", block: true } },
  { id: "h2", label: "Heading 2", keywords: ["heading", "h2"], icon: "markdown", textGlyph: "H2", snippet: { text: "## ", block: true } },
  { id: "h3", label: "Heading 3", keywords: ["heading", "h3"], icon: "markdown", textGlyph: "H3", snippet: { text: "### ", block: true } },
  { id: "bullet", label: "Bullet list", keywords: ["list", "ul", "unordered"], icon: "list", snippet: { text: "- ", block: true } },
  { id: "ordered", label: "Ordered list", keywords: ["list", "ol", "numbered"], icon: "list-ordered", snippet: { text: "1. ", block: true } },
  { id: "task", label: "Task list", keywords: ["todo", "checkbox", "task"], icon: "check", snippet: { text: "- [ ] ", block: true } },
  { id: "quote", label: "Quote", keywords: ["blockquote", "quote"], icon: "quote", snippet: { text: "> ", block: true } },
  ...CALLOUT_KINDS.map((kind): InsertItem => ({
    id: `callout-${kind}`,
    label: CALLOUT_LABELS[kind],
    keywords: ["callout", "alert", kind],
    icon: `callout-${kind}` as IconName,
    snippet: calloutSnippet(kind),
  })),
  {
    id: "toggle",
    label: "Toggle",
    keywords: ["toggle", "collapse", "details", "disclosure"],
    icon: "toggle",
    snippet: {
      text: ":::toggle Summary\n\n:::\n",
      selectFrom: ":::toggle ".length,
      selectTo: ":::toggle Summary".length,
      block: true,
    },
  },
  {
    id: "columns",
    label: "Columns",
    keywords: ["columns", "layout", "side by side"],
    icon: "columns",
    snippet: {
      text: ":::columns\n\n---\n\n:::\n",
      selectFrom: ":::columns\n".length,
      selectTo: ":::columns\n".length,
      block: true,
    },
  },
  {
    id: "table",
    label: "Table",
    keywords: ["table", "grid"],
    icon: "table",
    snippet: {
      text: TABLE_SNIPPET_TEXT,
      selectFrom: "| ".length,
      selectTo: "| ".length + "Column 1".length,
      block: true,
    },
  },
  {
    id: "codeblock",
    label: "Code block",
    keywords: ["code", "snippet", "fence"],
    icon: "code-block",
    snippet: { text: "```\n\n```", selectFrom: "```\n".length, selectTo: "```\n".length, block: true },
  },
  {
    id: "divider",
    label: "Divider",
    keywords: ["divider", "hr", "rule", "separator"],
    icon: "divider",
    snippet: { text: "---\n", block: true },
  },
];

export function filterInsertItems(query: string): InsertItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return INSERT_ITEMS;
  return INSERT_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}
