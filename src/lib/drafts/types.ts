import type { DocSettings } from "@/lib/blocks";

export type PublishedSnapshotRef = {
  /** Published document id (immutable snapshot). */
  id: string;
  /** Absolute share URL for the published document. */
  url: string;
  /** ISO timestamp captured when the publish completed on the client. */
  createdAt: string;
  /** True when the publish was made by an authenticated user and the page
   *  is owned in D1 (permanent, editable). False for anonymous publishes. */
  owned?: boolean;
};

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

  /** Raw markdown source (editor input). */
  raw: string;

  /** Rendering + layout preferences. */
  settings: DocSettings;

  /** Linkage to the most recent published snapshot for this draft (if any). */
  lastPublished?: PublishedSnapshotRef;

  /** Recent publish history for this draft (most recent first). */
  publishHistory?: PublishedSnapshotRef[];
};

export type DraftMeta = Pick<
  DraftDoc,
  "id" | "title" | "createdAt" | "updatedAt"
>;

export type DraftCreateInput = Partial<
  Pick<DraftDoc, "title" | "raw" | "settings">
>;

export type DraftUpdatePatch = Partial<
  Pick<
    DraftDoc,
    "title" | "raw" | "settings" | "lastPublished" | "publishHistory"
  >
>;

/**
 * Drafts DB V1 persisted shape (Epic 2A initial draft) — supported for migration.
 * Stored as JSON in localStorage.
 */
export type DraftsDbV1 = {
  schemaVersion: 1;
  drafts: Record<string, unknown>;
};

/**
 * Drafts DB V2 persisted shape.
 * Stored as JSON in localStorage.
 */
export type DraftsDbV2 = {
  schemaVersion: 2;
  drafts: Record<string, DraftDoc>;
};

export type DraftsDb = DraftsDbV2;
