/**
 * `wikilink` is a drafting-time-only inline (private `[[Draft Title]]`
 * cross-references between a user's own local drafts — see
 * src/lib/wikilinks/). It must never reach a stored/published `Block[]`:
 * every publish/patch route runs `stripWikilinksFromBlocks` (src/lib/
 * wikilinks/strip.ts) before `validateBlocks`, converting it to plain text.
 * `block-schema.ts`'s InlineSchema deliberately has no "wikilink" arm, so a
 * skipped strip step fails publish loudly instead of leaking this private
 * concept onto a public page.
 */
export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "del"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] }
  | { t: "image"; src: string; alt: string }
  | { t: "math"; v: string }
  | { t: "footnoteRef"; id: string; n: number }
  | { t: "wikilink"; target: string; label?: string };

/** A list item. `children` holds nested block content (nested lists, blockquotes, etc). */
export type ListItem = {
  inl: Inline[];
  checked?: boolean | null;
  children?: Block[];
};

/** Callout marker kinds, in the GitHub/Obsidian `> [!KIND]` convention. */
export const CALLOUT_KINDS = ["note", "tip", "warning", "important", "caution"] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

/** Per-column text alignment for a table, from GFM's `:---:`-style delimiter row. */
export type TableAlign = "left" | "center" | "right" | null;

/** One resolved footnote: `n` is its 1-based display index, in first-reference order. */
export type FootnoteItem = { id: string; n: number; blocks: Block[] };

export type Block =
  | { t: "heading"; level: 1 | 2 | 3 | 4; inl: Inline[] }
  | { t: "paragraph"; inl: Inline[] }
  | { t: "list"; ordered: boolean; items: ListItem[] }
  | { t: "quote"; blocks: Block[] }
  | { t: "callout"; kind: CalloutKind; blocks: Block[] }
  | { t: "toggle"; summary: string; blocks: Block[] }
  | { t: "columns"; columns: Block[][] }
  | { t: "code"; lang?: string; code: string }
  | { t: "table"; head: Inline[][]; rows: Inline[][][]; align: TableAlign[] }
  | { t: "hr" }
  | { t: "image"; src: string; alt: string }
  | { t: "diagram"; lang: string; code: string }
  | { t: "math"; display: true; code: string }
  | { t: "footnotes"; items: FootnoteItem[] };

/**
 * Hard bounds on a parsed document's shape, enforced during parsing
 * (src/lib/parse.ts) — not just at the API boundary. Every recursive
 * consumer of `Block[]` (the React renderer, the HTML exporter, the TOC
 * builder, the reading-time/rich-block-usage walkers) recurses without its
 * own depth limit, so a Block[] tree deeper than this would eventually blow
 * the call stack in *some* consumer even if the parser itself survived
 * producing it. Bounding depth at the one place all of them originate from
 * — the parser — is the single choke point that protects every consumer at
 * once, rather than adding a depth check to each one separately.
 *
 * 32 is far below any real document's nesting (double-digit blockquote/list
 * nesting is already unusual) and orders of magnitude below where V8's
 * default call stack actually overflows, leaving a comfortable safety
 * margin for however many stack frames each consumer's own recursion adds
 * per level.
 */
export const MAX_BLOCK_DEPTH = 32;

/** Hard cap on total blocks in a parsed document, independent of depth — bounds
 * a pathologically wide-but-shallow tree the same way MAX_BLOCK_DEPTH bounds
 * a deep one. Generous for any real document within STORAGE.maxInputChars. */
export const MAX_BLOCK_COUNT = 20_000;

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
  if (b.t === "footnotes") return b.items.map((it) => it.blocks);
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
  typeface: "sans",
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
