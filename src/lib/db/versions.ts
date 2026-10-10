import type { PublishedDoc } from "@/lib/blocks";
import { getD1 } from "@/lib/d1";
import type { PageVersion } from "./types";

const MAX_VERSIONS_PER_PAGE = 50;

export type PageVersionListItem = Pick<
  PageVersion,
  "id" | "page_id" | "version_number" | "created_at" | "size_bytes"
>;

/**
 * Snapshots `doc` as the next version of `pageId`.
 *
 * Concurrency: the next number is computed inside the INSERT itself. D1
 * runs one statement at a time per database, so two callers cannot read
 * the same maximum. The MongoDB version needed a unique index and a retry
 * loop for this; the unique index stays as a guard, the loop is gone.
 */
export async function snapshotPageVersion(
  pageId: string,
  doc: PublishedDoc,
): Promise<void> {
  const json = JSON.stringify(doc);
  const sizeBytes = new TextEncoder().encode(json).byteLength;
  const db = getD1();

  await db.batch([
    db
      .prepare(
        `INSERT INTO page_versions (id, page_id, version_number, doc_snapshot, created_at, size_bytes)
         SELECT ?, ?, COALESCE(MAX(version_number), 0) + 1, ?, ?, ? FROM page_versions WHERE page_id = ?`,
      )
      .bind(crypto.randomUUID(), pageId, json, new Date().toISOString(), sizeBytes, pageId),
    db
      .prepare(
        `DELETE FROM page_versions WHERE page_id = ? AND version_number <=
           (SELECT MAX(version_number) FROM page_versions WHERE page_id = ?) - ?`,
      )
      .bind(pageId, pageId, MAX_VERSIONS_PER_PAGE),
  ]);
}

export async function getPageVersions(pageId: string): Promise<PageVersionListItem[]> {
  const { results } = await getD1()
    .prepare(
      "SELECT id, page_id, version_number, created_at, size_bytes FROM page_versions WHERE page_id = ? ORDER BY version_number DESC",
    )
    .bind(pageId)
    .all<PageVersionListItem>();
  return results;
}

export async function getPageVersion(
  pageId: string,
  versionNumber: number,
): Promise<PublishedDoc | null> {
  const row = await getD1()
    .prepare("SELECT doc_snapshot FROM page_versions WHERE page_id = ? AND version_number = ?")
    .bind(pageId, versionNumber)
    .first<{ doc_snapshot: string }>();
  return row ? (JSON.parse(row.doc_snapshot) as PublishedDoc) : null;
}

export async function deletePageVersions(pageId: string): Promise<void> {
  await getD1().prepare("DELETE FROM page_versions WHERE page_id = ?").bind(pageId).run();
}
