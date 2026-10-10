/**
 * Whether a page must answer 410 Gone, and why. One function answers for
 * every surface — the middleware (via /api/pages/:id/gone), the share and
 * embed pages' own render guards, and the reports/claim routes.
 */

import { getPageBySlug, getPageRecord } from "@/lib/db";
import { getDocState, type DocState } from "@/lib/storage";
import { GONE_MESSAGES, type GoneReason } from "@/lib/gone-notice";

export { GONE_MESSAGES, type GoneReason };

async function resolve(idOrSlug: string): Promise<{ id: string; state: DocState } | null> {
  if (typeof idOrSlug !== "string" || !idOrSlug) return null;
  const direct = await getDocState(idOrSlug);
  if (direct) return { id: idOrSlug, state: direct };
  const bySlug = await getPageBySlug(idOrSlug);
  const state = bySlug ? await getDocState(bySlug.id) : null;
  return bySlug && state ? { id: bySlug.id, state } : null;
}

/** Resolves a page id or custom slug to the id of a stored document, or null. */
export async function resolvePageId(idOrSlug: string): Promise<string | null> {
  return (await resolve(idOrSlug))?.id ?? null;
}

/**
 * Null for a page that should be served — and for one that does not exist
 * at all, which is the caller's 404 to give, not a 410.
 */
export async function getGoneReason(idOrSlug: string): Promise<GoneReason | null> {
  const page = await resolve(idOrSlug);
  if (!page) return null;
  const { id, state } = page;

  if (state.takenDownAt) return "taken_down";

  if (state.expiresAt && state.expiresAt.getTime() <= Date.now()) {
    // Expiry only ever applies to a page nobody owns. A `pages` record
    // wins over a leftover expires_at, so a claimed page cannot expire.
    if (!(await getPageRecord(id))) return "expired";
  }

  return null;
}
