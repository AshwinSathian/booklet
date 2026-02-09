import type { Block, DocSettings } from "@/lib/blocks";

export type DraftDoc = {
  /** Primary identifier for the draft (local only). */
  id: string;

  /** Content schema version for the draft document. */
  v: number;

  /** ISO string timestamps. */
  createdAt: string;
  updatedAt: string;

  /** Human-editable title (explicitly stored). */
  title: string;

  /** Rendering + layout preferences. */
  settings: DocSettings;

  /** Structured block content. */
  blocks: Block[];
};

export type DraftMeta = Pick<
  DraftDoc,
  "id" | "title" | "createdAt" | "updatedAt"
>;

export type DraftCreateInput = Partial<
  Pick<DraftDoc, "title" | "settings" | "blocks">
>;

export type DraftUpdatePatch = Partial<
  Pick<DraftDoc, "title" | "settings" | "blocks">
>;

/**
 * Drafts DB V1 persisted shape.
 * Stored as JSON in localStorage.
 */
export type DraftsDbV1 = {
  schemaVersion: 1;
  drafts: Record<string, DraftDoc>;
};

export type DraftsDb = DraftsDbV1;
