import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { PublishedDoc } from "./blocks";
import { STORAGE } from "./constants";

export async function putDoc(id: string, doc: PublishedDoc): Promise<void> {
  const json = JSON.stringify(doc);
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > STORAGE.maxDocBytes) {
    throw new Error("Document is too large to publish.");
  }

  const kv = getCloudflareContext().env.READABLE_DOCS;
  await kv.put(id, json, { expirationTtl: STORAGE.ttlSeconds });
}

export async function getDoc(id: string): Promise<PublishedDoc | null> {
  const kv = getCloudflareContext().env.READABLE_DOCS;
  const raw = await kv.get(id);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PublishedDoc;
  } catch {
    return null;
  }
}
