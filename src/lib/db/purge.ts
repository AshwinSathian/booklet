import { getD1, type D1 } from "../d1";
import { PURGE_GRACE_DAYS } from "./expiry.mjs";

/**
 * Deletes anonymous documents more than PURGE_GRACE_DAYS past expiry,
 * along with the rows keyed to them. Returns how many were deleted. Run
 * daily by the Worker's Cron Trigger (custom-worker.ts), which passes the
 * binding in because a scheduled event has no request context.
 *
 * "Anonymous" means no row in `pages`: a page with an owner is never
 * deleted here, whatever its expires_at says.
 */
export async function purgeExpiredAnonymousDocs(now = Date.now(), db: D1 = getD1()): Promise<number> {
  const cutoff = now - PURGE_GRACE_DAYS * 86_400_000;
  // The owner check and the expiry check are inside the DELETE itself, so
  // a claim (which clears expires_at before it creates the pages row)
  // cannot lose to this statement.
  // ponytail: 1,000 per run. A larger backlog drains over successive
  // daily runs; raise it if anonymous volume ever gets there.
  const { results } = await db
    .prepare(
      `DELETE FROM docs WHERE id IN (
         SELECT d.id FROM docs d
         WHERE d.expires_at < ? AND NOT EXISTS (SELECT 1 FROM pages p WHERE p.id = d.id)
         LIMIT 1000
       ) AND expires_at < ? RETURNING id`,
    )
    .bind(cutoff, cutoff)
    .all<{ id: string }>();

  for (const { id } of results) {
    await db.batch([
      db.prepare("DELETE FROM analytics_events WHERE page_id = ?").bind(id),
      db.prepare("DELETE FROM publish_events WHERE page_id = ?").bind(id),
      db.prepare("DELETE FROM page_versions WHERE page_id = ?").bind(id),
    ]);
  }
  return results.length;
}

/** Replaces MongoDB's TTL indexes. Run hourly by the Cron Trigger. */
export async function deleteExpiredRows(now = Date.now(), db: D1 = getD1()): Promise<number> {
  const res = await db.batch(
    ["sessions", "password_reset_tokens", "rate_limits", "view_dedupe", "analytics_events"].map((table) =>
      db.prepare(`DELETE FROM ${table} WHERE expires_at < ?`).bind(now),
    ),
  );
  return res.reduce((n, r) => n + r.meta.changes, 0);
}
