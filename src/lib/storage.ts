import { getD1 } from "@/lib/d1";
import type { PublishedDoc } from "./blocks";
import { STORAGE } from "./constants";

/**
 * A stored document plus the page-level state that has to exist even when
 * there is no `pages` record — anonymous publishes never get one, and they
 * are exactly the pages that expire and that most need a takedown path.
 *
 * docs.doc is the document as JSON text. The largest allowed document
 * (STORAGE.maxDocBytes) is under D1's 2 MB row limit.
 */
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

  // A content update must leave taken_down_at and expires_at alone, or
  // re-publishing would lift a takedown.
  const db = getD1();
  if (anonymous) {
    await db
      .prepare(
        `INSERT INTO docs (id, doc, expires_at, claim_token_hash) VALUES (?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET doc = excluded.doc, expires_at = excluded.expires_at, claim_token_hash = excluded.claim_token_hash`,
      )
      .bind(id, json, anonymous.expiresAt.getTime(), anonymous.claimTokenHash)
      .run();
  } else {
    await db
      .prepare("INSERT INTO docs (id, doc) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET doc = excluded.doc")
      .bind(id, json)
      .run();
  }
}

export async function deleteDoc(id: string): Promise<void> {
  await getD1().prepare("DELETE FROM docs WHERE id = ?").bind(id).run();
}

export async function getDoc(id: string): Promise<PublishedDoc | null> {
  const row = await getD1().prepare("SELECT doc FROM docs WHERE id = ?").bind(id).first<{ doc: string }>();
  return row ? (JSON.parse(row.doc) as PublishedDoc) : null;
}

/** Page-level state without loading the document body. Null if no such doc. */
export async function getDocState(id: string): Promise<DocState | null> {
  if (typeof id !== "string") return null;
  const row = await getD1()
    .prepare("SELECT expires_at, claim_token_hash, taken_down_at FROM docs WHERE id = ?")
    .bind(id)
    .first<{ expires_at: number | null; claim_token_hash: string | null; taken_down_at: string | null }>();
  if (!row) return null;
  return {
    expiresAt: row.expires_at === null ? null : new Date(row.expires_at),
    claimTokenHash: row.claim_token_hash,
    takenDownAt: row.taken_down_at,
  };
}

export async function markDocTakenDown(id: string, at: string): Promise<boolean> {
  const res = await getD1().prepare("UPDATE docs SET taken_down_at = ? WHERE id = ?").bind(at, id).run();
  return res.meta.changes === 1;
}

/** First step of a claim: the page no longer expires. */
export async function clearDocExpiry(id: string): Promise<void> {
  await getD1().prepare("UPDATE docs SET expires_at = NULL WHERE id = ?").bind(id).run();
}

/** Last step of a claim: the claim cookie is spent. */
export async function clearClaimToken(id: string): Promise<void> {
  await getD1().prepare("UPDATE docs SET claim_token_hash = NULL WHERE id = ?").bind(id).run();
}
