import { getDb } from "@/lib/mongodb";
import { deletePageAssociatedRecords } from "@/lib/db";
import { deletePageVersions } from "@/lib/db/versions";
import { PURGE_GRACE_DAYS } from "@/lib/db/expiry.mjs";

/**
 * Deletes anonymous documents more than PURGE_GRACE_DAYS past expiry,
 * along with the rows keyed to them. Returns how many were deleted. Run
 * daily from src/instrumentation.ts.
 *
 * "Anonymous" means no record in `pages`: a page with an owner is never
 * deleted here, whatever its expires_at says.
 */
export async function purgeExpiredAnonymousDocs(now = Date.now()): Promise<number> {
  const db = await getDb();
  const cutoff = new Date(now - PURGE_GRACE_DAYS * 86_400_000);
  const docs = db.collection<{ _id: string; expires_at?: Date }>("docs");
  const candidates = await docs
    .find({ expires_at: { $lt: cutoff } }, { projection: { _id: 1 } })
    // ponytail: 1,000 per run. A larger backlog drains over successive
    // daily runs; raise it if anonymous volume ever gets there.
    .limit(1000)
    .toArray();

  let deleted = 0;
  for (const { _id } of candidates) {
    if (await db.collection("pages").findOne({ _id } as never, { projection: { _id: 1 } })) continue;
    // expires_at is re-checked in the delete itself. The claim route unsets
    // it BEFORE creating the pages record, so a claim that started after
    // the owner check above still wins: this delete then matches nothing.
    const res = await docs.deleteOne({ _id, expires_at: { $lt: cutoff } });
    if (res.deletedCount !== 1) continue;
    deleted++;
    await Promise.all([deletePageAssociatedRecords(_id), deletePageVersions(_id)]);
  }
  return deleted;
}
