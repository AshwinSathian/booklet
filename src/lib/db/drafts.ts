import { getDb } from "@/lib/mongodb";
import type { DraftDoc, DraftMeta } from "@/lib/drafts/types";

// ---------------------------------------------------------------------------
// Cloud draft sync (P4-2) — mirrors src/lib/db/index.ts's pages CRUD
// conventions: MongoDB _id = the draft's own client-generated id, and a
// separate `user_id` field for ownership, checked by callers (API routes)
// the same way pages' `record.user_id !== userId` is checked.
//
// Documents here are shaped like DraftDoc (camelCase createdAt/updatedAt,
// same as the client's localStorage shape) plus `user_id` — deliberately
// not normalized to the snake_case used elsewhere in this file, so a
// synced draft can be written/read without field-name translation at the
// sync boundary (src/lib/drafts/cloud-sync.ts).
// ---------------------------------------------------------------------------

type DraftRecordDoc = Omit<DraftDoc, "id"> & { _id: string; user_id: string };

export type DbDraft = DraftDoc & { user_id: string };

function toDraft(doc: DraftRecordDoc): DbDraft {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

/**
 * Metadata-only listing for a signed-in user's cloud drafts (id/title/
 * timestamps — never full content), mirroring DraftMeta vs DraftDoc's
 * existing split in src/lib/drafts/types.ts. Sorted most-recent-first, same
 * as the local store's listDrafts().
 */
export async function getDraftsByUser(userId: string): Promise<DraftMeta[]> {
  const db = await getDb();
  const docs = await db
    .collection<DraftRecordDoc>("drafts")
    .find({ user_id: userId })
    .sort({ updatedAt: -1 })
    .project<Pick<DraftRecordDoc, "_id" | "title" | "createdAt" | "updatedAt">>({
      _id: 1,
      title: 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .toArray();

  return docs.map((d) => ({
    id: d._id,
    title: d.title,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

/** Full draft content + owner, for ownership checks and GET /api/drafts/[id]. */
export async function getDraftRecord(id: string): Promise<DbDraft | null> {
  const db = await getDb();
  const doc = await db.collection<DraftRecordDoc>("drafts").findOne({ _id: id });
  return doc ? toDraft(doc) : null;
}

/**
 * Create-or-update a draft for a given owner. Callers must verify ownership
 * against an existing record *before* calling this (see PUT /api/drafts/[id]
 * — same pattern as pages' updatePageRecord call sites), since this always
 * writes the given userId unconditionally.
 */
export async function upsertDraftRecord(
  id: string,
  userId: string,
  doc: DraftDoc,
): Promise<void> {
  const db = await getDb();
  const { id: _ignored, ...rest } = doc;
  await db.collection<DraftRecordDoc>("drafts").updateOne(
    { _id: id },
    { $set: { ...rest, user_id: userId } },
    { upsert: true },
  );
}

export async function deleteDraftRecord(id: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.collection<DraftRecordDoc>("drafts").deleteOne({ _id: id, user_id: userId });
}
