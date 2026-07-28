/**
 * Threaded through BlockRenderer → Callout/Toggle/Columns → InlineRenderer
 * the same way `headingAnchors` already is (see BlockRenderer.tsx). Only
 * ever populated by the editor's live-preview render (AppClient.tsx) — a
 * published page never has wikilink inlines to resolve (see
 * src/lib/wikilinks/strip.ts), so this prop is simply omitted there and
 * every consumer's existing (no-wikilink-context) behavior is unchanged.
 */
export type WikilinkRenderCtx = {
  /** True if `target` matches one of the user's own local draft titles
   * (case-insensitive, exact match — see src/lib/wikilinks/resolve.ts). */
  isResolved: (target: string) => boolean;
  /** Invoked when the user clicks a resolved wikilink in the preview. */
  onNavigate?: (target: string) => void;
};
