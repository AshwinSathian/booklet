import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { PublishedDoc } from "./blocks";
import { STORAGE } from "./constants";
import { checkAndBumpQuota } from "./quota";

export async function putDoc(
  id: string,
  doc: PublishedDoc,
  permanent = false,
): Promise<void> {
  const json = JSON.stringify(doc);
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > STORAGE.maxDocBytes) {
    throw new Error("Document is too large to publish.");
  }

  await checkAndBumpQuota("KV_WRITES");

  const kv = getCloudflareContext().env.READABLE_DOCS;
  if (permanent) {
    await kv.put(id, json);
  } else {
    await kv.put(id, json, { expirationTtl: STORAGE.ttlSeconds });
  }
}

export async function deleteDoc(id: string): Promise<void> {
  await checkAndBumpQuota("KV_DELETES");

  const kv = getCloudflareContext().env.READABLE_DOCS;
  await kv.delete(id);
}

export async function getDoc(id: string): Promise<PublishedDoc | null> {
  await checkAndBumpQuota("KV_READS");

  const kv = getCloudflareContext().env.READABLE_DOCS;
  const raw = await kv.get(id);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PublishedDoc;
  } catch {
    return null;
  }
}
