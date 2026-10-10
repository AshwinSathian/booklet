/**
 * Lifecycle of pages published without an account.
 *
 * The daily purge is in purge.ts.
 *
 * "Anonymous" always means a document in `docs` with no record in `pages`.
 * Nothing trusts `expires_at` alone — a page that has an owner is never
 * deleted and never stamped, whatever its fields say.
 */

/** How long an unclaimed anonymous page is served. */
export const ANONYMOUS_PAGE_TTL_DAYS = 90;
/** How long after expiry the document is kept before the purge deletes it. */
export const PURGE_GRACE_DAYS = 30;
