export const ANALYTICS_EVENTS = {
  // Phase 2: drafts + retention loop
  draft_created: "draft_created",
  draft_opened: "draft_opened",
  draft_renamed: "draft_renamed",
  draft_deleted: "draft_deleted",
  draft_duplicated: "draft_duplicated",

  draft_autosave: "draft_autosave",

  publish_from_draft: "publish_from_draft",

  export_copy_markdown: "export_copy_markdown",
  export_copy_html: "export_copy_html",

  // Marketing / Phase 1
  example_clicked: "example_clicked",
  open_editor_clicked: "open_editor_clicked",

  // Existing Phase 1 events (kept for backward compatibility)
  publish_success: "publish_success",
  publish_error: "publish_error",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * Stable, dependency-free hash suitable for analytics identifiers.
 * Not cryptographically secure; intended only to avoid sending raw IDs.
 */
export function hashId(input: string): string {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // h *= 16777619 (with 32-bit overflow)
    h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
