export const DRAFTS_DB = {
  /**
   * The version of the Drafts DB schema stored in localStorage.
   * Bump when the persisted shape changes.
   */
  schemaVersion: 1,
} as const;

export const DRAFTS_STORAGE_KEYS = {
  db: "readable:draftsDb",
} as const;

export const DRAFT_DOC = {
  /**
   * The version of the DraftDoc content schema.
   * This is separate from the Drafts DB schema version.
   */
  version: 1,

  /** Default title used for new drafts when none is provided. */
  defaultTitle: "Untitled",

  /** Suffix used when duplicating a draft. */
  duplicateSuffix: " (copy)",
} as const;
