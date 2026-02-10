export const DRAFTS_DB = {
  /**
   * The version of the Drafts DB schema stored in localStorage.
   * Bump when the persisted shape changes.
   */
  schemaVersion: 2,
} as const;

export const DRAFTS_STORAGE_KEYS = {
  db: "readable:draftsDb",
  activeDraftId: "readable:activeDraftId",
} as const;

export const DRAFT_DOC = {
  /**
   * The version of the DraftDoc content schema.
   * This is separate from the Drafts DB schema version.
   */
  version: 2,

  /** Default title used for new drafts when none is provided. */
  defaultTitle: "Untitled",

  /** Suffix used when duplicating a draft. */
  duplicateSuffix: " (copy)",
} as const;

export const AUTOSAVE = {
  debounceMs: 450,
} as const;

export const PUBLISH_LINKAGE = {
  /** How many recent publish snapshots to keep per draft (most recent first). */
  historyLimit: 5,
} as const;

export const DRAFTS_PERSIST = {
  errorCode: {
    quota: "quota",
    unknown: "unknown",
  },
} as const;
