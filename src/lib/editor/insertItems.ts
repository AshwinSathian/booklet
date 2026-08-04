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
};

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
  return { text, selectFrom: text.length };
}

export const TABLE_SNIPPET_TEXT =
  "| Column 1 | Column 2 | Column 3 |\n" +
  "| --- | --- | --- |\n" +
  "| Cell | Cell | Cell |\n" +
  "| Cell | Cell | Cell |";

export const INSERT_ITEMS: InsertItem[] = [
  { id: "h1", label: "Heading 1", keywords: ["heading", "h1", "title"], icon: "markdown", textGlyph: "H1", snippet: { text: "# " } },
  { id: "h2", label: "Heading 2", keywords: ["heading", "h2"], icon: "markdown", textGlyph: "H2", snippet: { text: "## " } },
  { id: "h3", label: "Heading 3", keywords: ["heading", "h3"], icon: "markdown", textGlyph: "H3", snippet: { text: "### " } },
  { id: "bullet", label: "Bullet list", keywords: ["list", "ul", "unordered"], icon: "list", snippet: { text: "- " } },
  { id: "ordered", label: "Ordered list", keywords: ["list", "ol", "numbered"], icon: "list-ordered", snippet: { text: "1. " } },
  { id: "task", label: "Task list", keywords: ["todo", "checkbox", "task"], icon: "check", snippet: { text: "- [ ] " } },
  { id: "quote", label: "Quote", keywords: ["blockquote", "quote"], icon: "quote", snippet: { text: "> " } },
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
    },
  },
  {
    id: "codeblock",
    label: "Code block",
    keywords: ["code", "snippet", "fence"],
    icon: "code-block",
    snippet: { text: "```\n\n```", selectFrom: "```\n".length, selectTo: "```\n".length },
  },
  {
    id: "divider",
    label: "Divider",
    keywords: ["divider", "hr", "rule", "separator"],
    icon: "divider",
    snippet: { text: "---\n" },
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
