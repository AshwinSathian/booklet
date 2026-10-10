import { getDb } from "@/lib/mongodb";
import type { PublishedDoc } from "./blocks";
import { STORAGE } from "./constants";

/**
 * A stored document plus the page-level state that has to exist even when
 * there is no `pages` record — anonymous publishes never get one, and they
 * are exactly the pages that expire and that most need a takedown path.
 */
type DocRecord = {
  _id: string;
  doc: PublishedDoc;
  /** Anonymous pages only: when the page stops being served. BSON Date. */
  expires_at?: Date;
  /** SHA-256 of the token in the publisher's `booklet_claim_<id>` cookie. */
  claim_token_hash?: string;
  /** ISO timestamp of an admin takedown. */
  taken_down_at?: string;
};

export type DocState = {
  expiresAt: Date | null;
  claimTokenHash: string | null;
  takenDownAt: string | null;
};

export async function putDoc(
  id: string,
  doc: PublishedDoc,
  /** Set only when creating an anonymous page. */
  anonymous?: { expiresAt: Date; claimTokenHash: string },
): Promise<void> {
  const json = JSON.stringify(doc);
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > STORAGE.maxDocBytes) {
    throw new Error("Document is too large to publish.");
  }

  const db = await getDb();

  // $set, not replaceOne: a content update must leave taken_down_at and
  // expires_at alone, or re-publishing would lift a takedown.
  await db.collection<DocRecord>("docs").updateOne(
    { _id: id },
    {
      $set: {
        doc,
        ...(anonymous ? { expires_at: anonymous.expiresAt, claim_token_hash: anonymous.claimTokenHash } : {}),
      },
    },
    { upsert: true },
  );
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await getDb();
  await db.collection<DocRecord>("docs").deleteOne({ _id: id });
}

export async function getDoc(id: string): Promise<PublishedDoc | null> {
  const db = await getDb();
  const record = await db.collection<DocRecord>("docs").findOne({ _id: id });
  return record?.doc ?? null;
}

/** Page-level state without loading the document body. Null if no such doc. */
export async function getDocState(id: string): Promise<DocState | null> {
  // Route params reach here unvalidated; a non-string must never become a
  // query operator.
  if (typeof id !== "string") return null;
  const db = await getDb();
  const record = await db
    .collection<DocRecord>("docs")
    .findOne({ _id: id }, { projection: { expires_at: 1, claim_token_hash: 1, taken_down_at: 1 } });
  if (!record) return null;
  return {
    expiresAt: record.expires_at ?? null,
    claimTokenHash: record.claim_token_hash ?? null,
    takenDownAt: record.taken_down_at ?? null,
  };
}

export async function markDocTakenDown(id: string, at: string): Promise<boolean> {
  const db = await getDb();
  const res = await db.collection<DocRecord>("docs").updateOne({ _id: id }, { $set: { taken_down_at: at } });
  return res.matchedCount === 1;
}

/** Called when an anonymous page is claimed: it no longer expires. */
export async function clearDocExpiry(id: string): Promise<void> {
  const db = await getDb();
  await db
    .collection<DocRecord>("docs")
    .updateOne({ _id: id }, { $unset: { expires_at: "", claim_token_hash: "" } });
}
