/**
 * Whether a page must answer 410 Gone, and why. One function answers for
 * every surface — the middleware (via /api/pages/:id/gone), the share and
 * embed pages' own render guards, and the reports/claim routes.
 */

import { getPageBySlug, getPageRecord } from "@/lib/db";
import { getDocState } from "@/lib/storage";
import { GONE_MESSAGES, type GoneReason } from "@/lib/gone-notice";

export { GONE_MESSAGES, type GoneReason };

/** Resolves a page id or custom slug to the id of a stored document, or null. */
export async function resolvePageId(idOrSlug: string): Promise<string | null> {
  if (typeof idOrSlug !== "string" || !idOrSlug) return null;
  if (await getDocState(idOrSlug)) return idOrSlug;
  const bySlug = await getPageBySlug(idOrSlug);
  return bySlug && (await getDocState(bySlug.id)) ? bySlug.id : null;
}

/**
 * Null for a page that should be served — and for one that does not exist
 * at all, which is the caller's 404 to give, not a 410.
 */
export async function getGoneReason(idOrSlug: string): Promise<GoneReason | null> {
  const id = await resolvePageId(idOrSlug);
  if (!id) return null;
  const state = await getDocState(id);
  if (!state) return null;

  if (state.takenDownAt) return "taken_down";

  if (state.expiresAt && state.expiresAt.getTime() <= Date.now()) {
    // Expiry only ever applies to a page nobody owns. A `pages` record
    // wins over a leftover expires_at, so a claimed page cannot expire.
    if (!(await getPageRecord(id))) return "expired";
  }

  return null;
}
