/**
 * Lifecycle of pages published without an account.
 *
 * Plain JS (not .ts) for the same reason as index-specs.mjs: it is imported
 * both by the app and by scripts/backfill-anonymous-expiry.mjs, a
 * standalone `node` script with no TypeScript loader. The daily purge,
 * which only the app runs, is in purge.ts.
 *
 * "Anonymous" always means a document in `docs` with no record in `pages`.
 * Nothing trusts `expires_at` alone — a page that has an owner is never
 * deleted and never stamped, whatever its fields say.
 */

const DAY_MS = 86_400_000;

/** How long an unclaimed anonymous page is served. */
export const ANONYMOUS_PAGE_TTL_DAYS = 90;
/** How long after expiry the document is kept before the purge deletes it. */
export const PURGE_GRACE_DAYS = 30;

async function hasOwner(db, id) {
  return (await db.collection("pages").findOne({ _id: id }, { projection: { _id: 1 } })) !== null;
}

/**
 * One-time migration, run by hand at the deploy that introduced expiry:
 * anonymous pages published before it get `expires_at` = now + 90 days.
 * Idempotent — a document that already has `expires_at` is left alone.
 *
 * Skips documents created in the last hour: a signed-in publish writes the
 * document first and its `pages` record a moment later, and in that window
 * it looks exactly like an anonymous page.
 *
 * Returns how many documents were stamped (or would be, with `dryRun`).
 */
export async function backfillAnonymousExpiry(db, { now = Date.now(), dryRun = false } = {}) {
  const expiresAt = new Date(now + ANONYMOUS_PAGE_TTL_DAYS * DAY_MS);
  const settledBefore = new Date(now - 3_600_000).toISOString();
  const cursor = db
    .collection("docs")
    .find({ expires_at: { $exists: false }, "doc.createdAt": { $lt: settledBefore } }, { projection: { _id: 1 } });

  let stamped = 0;
  for await (const { _id } of cursor) {
    if (await hasOwner(db, _id)) continue;
    if (!dryRun) {
      const res = await db
        .collection("docs")
        .updateOne({ _id, expires_at: { $exists: false } }, { $set: { expires_at: expiresAt } });
      if (res.modifiedCount !== 1) continue;
    }
    stamped++;
  }
  return stamped;
}
