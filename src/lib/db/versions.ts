import type { PublishedDoc } from "@/lib/blocks";
import { getDb } from "@/lib/mongodb";
import type { PageVersion } from "./types";

const MAX_VERSIONS_PER_PAGE = 10;

export type PageVersionListItem = Pick<
  PageVersion,
  "id" | "page_id" | "version_number" | "created_at" | "size_bytes"
>;

export async function snapshotPageVersion(
  pageId: string,
  doc: PublishedDoc,
): Promise<void> {
  const db = await getDb();
  const coll = db.collection<PageVersion>("page_versions");

  const latest = await coll
    .find({ page_id: pageId })
    .sort({ version_number: -1 })
    .limit(1)
    .toArray();

  const json = JSON.stringify(doc);
  const encoded = new TextEncoder().encode(json);
  const versionNumber = (latest[0]?.version_number ?? 0) + 1;

  await coll.insertOne({
    id: crypto.randomUUID(),
    page_id: pageId,
    version_number: versionNumber,
    doc_snapshot: json,
    created_at: new Date().toISOString(),
    size_bytes: encoded.byteLength,
  });

  const stale = await coll
    .find({ page_id: pageId })
    .sort({ version_number: -1 })
    .skip(MAX_VERSIONS_PER_PAGE)
    .project<{ id: string }>({ id: 1, _id: 0 })
    .toArray();

  if (stale.length > 0) {
    await coll.deleteMany({ id: { $in: stale.map((v) => v.id) } });
  }
}

export async function getPageVersions(pageId: string): Promise<PageVersionListItem[]> {
  const db = await getDb();
  return db
    .collection<PageVersion>("page_versions")
    .find({ page_id: pageId })
    .sort({ version_number: -1 })
    .project<PageVersionListItem>({
      id: 1,
      page_id: 1,
      version_number: 1,
      created_at: 1,
      size_bytes: 1,
      _id: 0,
    })
    .toArray();
}

export async function getPageVersion(
  pageId: string,
  versionNumber: number,
): Promise<PublishedDoc | null> {
  const db = await getDb();
  const version = await db
    .collection<PageVersion>("page_versions")
    .findOne({ page_id: pageId, version_number: versionNumber });

  if (!version) return null;
  return JSON.parse(version.doc_snapshot) as PublishedDoc;
}

export async function deletePageVersions(pageId: string): Promise<void> {
  const db = await getDb();
  await db.collection<PageVersion>("page_versions").deleteMany({ page_id: pageId });
}
