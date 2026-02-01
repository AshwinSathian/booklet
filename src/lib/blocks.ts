export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; c: Inline[] }
  | { t: "em"; c: Inline[] }
  | { t: "code"; v: string }
  | { t: "link"; href: string; c: Inline[] };

export type Block =
  | { t: "heading"; level: 1 | 2 | 3 | 4; inl: Inline[] }
  | { t: "paragraph"; inl: Inline[] }
  | { t: "list"; ordered: boolean; items: Inline[][] }
  | { t: "quote"; blocks: Block[] }
  | { t: "code"; lang?: string; code: string }
  | { t: "table"; head: Inline[][]; rows: Inline[][][] }
  | { t: "hr" };

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
