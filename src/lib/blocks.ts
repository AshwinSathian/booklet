export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "del"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "image"; src: string; alt: string }
  | { t: "math"; v: string };

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
  | { t: "diagram"; lang: string; code: string }
  | { t: "math"; display: true; code: string };

export type DocSettings = {
  spacing: "compact" | "comfortable";
  width: "normal" | "wide";
  code: "show" | "collapse";
  // Reading typeface for published-page body content — "serif" is the
  // distinctive reading face (--font-reading, Source Serif 4); "sans" opts
  // back into the UI's own font (--font-body, Inter) for authors who prefer
  // it. Docs published before this field existed have no stored value —
  // BlockRenderer treats a missing/undefined typeface as "serif" (the
  // current default), not as "sans", so old docs pick up the new reading
  // typography rather than silently opting out of it.
  typeface?: "sans" | "serif";
  // Curated CSS theme id for published-page presentation (src/lib/themes.ts)
  // — a fixed, developer-authored set of CSS custom-property overrides, not
  // arbitrary user CSS. Missing/unknown/tampered values always resolve to
  // the default theme via getTheme(), never indexed directly.
  theme?: string;
};

export type PublishedDoc = {
  v: number;
  createdAt: string;
  settings: DocSettings;
  blocks: Block[];
  raw?: string; // original markdown source; present for docs published after this field was added
};

export const DEFAULT_SETTINGS: DocSettings = {
  spacing: "comfortable",
  width: "normal",
  code: "collapse",
  typeface: "serif",
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
