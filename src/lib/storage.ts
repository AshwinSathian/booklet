import { getDb } from "@/lib/mongodb";
import type { PublishedDoc } from "./blocks";
import { STORAGE } from "./constants";

type DocRecord = {
  _id: string;
  doc: PublishedDoc;
};

export async function putDoc(
  id: string,
  doc: PublishedDoc,
): Promise<void> {
  const json = JSON.stringify(doc);
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > STORAGE.maxDocBytes) {
    throw new Error("Document is too large to publish.");
  }

  const db = await getDb();
  const record: DocRecord = { _id: id, doc };

  await db
    .collection<DocRecord>("docs")
    .replaceOne({ _id: id }, record, { upsert: true });
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
