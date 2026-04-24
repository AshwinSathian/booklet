export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "del"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "image"; src: string; alt: string };

/**
 * A list item. The `children` field holds nested block content (nested lists,
 * blockquotes, etc.). `checked` is null for regular items, true/false for task
 * list items.
 *
 * Backwards-compat note: older published documents stored items as Inline[]
 * directly. The renderer guards against both shapes.
 */
export type ListItem = {
  inl: Inline[];
  checked?: boolean | null;
  children?: Block[];
};

export type Block =
  | { t: "heading"; level: 1 | 2 | 3 | 4; inl: Inline[] }
  | { t: "paragraph"; inl: Inline[] }
  | { t: "list"; ordered: boolean; items: ListItem[] }
  | { t: "quote"; blocks: Block[] }
  | { t: "code"; lang?: string; code: string }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "hr" }
  | { t: "image"; src: string; alt: string }
  | { t: "diagram"; lang: string; code: string };

export type DocSettings = {
  spacing: "compact" | "comfortable";
  width: "normal" | "wide";
  code: "show" | "collapse";
};

export type PublishedDoc = {
  v: number;
  createdAt: string;
  settings: DocSettings;
  blocks: Block[];
};

export const DEFAULT_SETTINGS: DocSettings = {
  spacing: "comfortable",
  width: "normal",
  code: "collapse",
};

/** Diagram languages that trigger the diagram block type. */
export const DIAGRAM_LANGS = new Set([
  "mermaid",
  "flowchart",
  "sequence",
  "gantt",
  "classDiagram",
  "stateDiagram",
  "erDiagram",
  "journey",
  "gitGraph",
  "mindmap",
  "timeline",
  "xychart",
  "sankey",
]);
