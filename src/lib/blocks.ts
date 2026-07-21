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

/** Callout marker kinds, in the GitHub/Obsidian `> [!KIND]` convention. */
export const CALLOUT_KINDS = ["note", "tip", "warning", "important", "caution"] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export type Block =
  | { t: "heading"; level: 1 | 2 | 3 | 4; inl: Inline[] }
  | { t: "paragraph"; inl: Inline[] }
  | { t: "list"; ordered: boolean; items: ListItem[] }
  | { t: "quote"; blocks: Block[] }
  | { t: "callout"; kind: CalloutKind; blocks: Block[] }
  | { t: "toggle"; summary: string; blocks: Block[] }
  | { t: "columns"; columns: Block[][] }
  | { t: "code"; lang?: string; code: string }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "hr" }
  | { t: "image"; src: string; alt: string }
  | { t: "diagram"; lang: string; code: string }
  | { t: "math"; display: true; code: string };

/**
 * Block kinds that hold nested Block[] content ("containers"). Centralized
 * here so every consumer that needs to recurse into nested content — TOC/
 * anchor generation, adoption-usage counting, and (in the future) anything
 * else that walks the tree — shares one definition instead of drifting out
 * of sync as new container kinds (toggle, columns) are added. Returns one
 * Block[] group per "slot" the container holds — a single slot for quote/
 * callout/toggle, one slot per column for a future multi-column container.
 */
export function containerChildGroups(b: Block): Block[][] | null {
  if (b.t === "quote" || b.t === "callout" || b.t === "toggle") return [b.blocks];
  if (b.t === "columns") return b.columns;
  return null;
}

/** Block kinds introduced by the Rich Markdown Blocks effort (see
 * PLAN-rich-markdown-blocks.md), tracked separately so real adoption data —
 * not the essay that prompted this work — drives whether further phases
 * (e.g. stat/dashboard blocks) get built at all. */
export const RICH_BLOCK_KINDS = new Set<Block["t"]>(["callout", "toggle", "columns"]);

/** Column count bounds for the `columns` block — enforced at parse time
 * (src/lib/parse.ts) and mirrored in the server-side schema
 * (src/lib/block-schema.ts). */
export const COLUMNS_MIN = 2;
export const COLUMNS_MAX = 4;

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

/**
 * Languages routed to the Graphviz-in-WASM compiler (@viz-js/viz) instead of
 * Mermaid — Graphviz's DOT language compiles deterministically to static
 * SVG with no client-side script execution needed, unlike a hosted
 * rendering service (deliberately rejected — see PLAN-rich-markdown-blocks.md
 * for why an outbound-call-dependent renderer is unacceptable on the
 * anonymous, rate-limited publish path) or PlantUML (needs a server-side
 * Java renderer, also rejected).
 */
export const GRAPHVIZ_LANGS = new Set(["dot", "graphviz"]);

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
  ...GRAPHVIZ_LANGS,
]);
