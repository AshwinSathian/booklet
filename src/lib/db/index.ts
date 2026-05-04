import { getDb } from "@/lib/mongodb";
import type { DbApiKey, DbPage, DbUser } from "./types";

// ---------------------------------------------------------------------------
// Internal document shapes (MongoDB _id = our string id)
// ---------------------------------------------------------------------------

type UserDoc = Omit<DbUser, "id"> & { _id: string };
type PageDoc = Omit<DbPage, "id"> & { _id: string };
type ApiKeyDoc = Omit<DbApiKey, "id"> & { _id: string };

function toUser(doc: UserDoc): DbUser {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function toPage(doc: PageDoc): DbPage {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function toApiKey(doc: ApiKeyDoc): DbApiKey {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUser(id: string): Promise<DbUser | null> {
  const db = await getDb();
  const doc = await db.collection<UserDoc>("users").findOne({ _id: id });
  return doc ? toUser(doc) : null;
}

export async function upsertUser(
  id: string,
  email: string | null,
): Promise<void> {
  const db = await getDb();
  await db.collection<UserDoc>("users").updateOne(
    { _id: id },
    {
      $set: { email },
      $setOnInsert: { _id: id, created_at: new Date().toISOString() },
    },
    { upsert: true },
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export async function createPageRecord(
  pageId: string,
  userId: string,
  title: string | null = null,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection<PageDoc>("pages").insertOne({
    _id: pageId,
    user_id: userId,
    slug: null,
    title,
    visibility: "public",
    view_count: 0,
    created_at: now,
    updated_at: now,
  });
}

export async function getPageRecord(pageId: string): Promise<DbPage | null> {
  const db = await getDb();
  const doc = await db.collection<PageDoc>("pages").findOne({ _id: pageId });
  return doc ? toPage(doc) : null;
}

export async function getPageBySlug(slug: string): Promise<DbPage | null> {
  const db = await getDb();
  const doc = await db.collection<PageDoc>("pages").findOne({ slug });
  return doc ? toPage(doc) : null;
}

export async function getPagesByUser(userId: string): Promise<DbPage[]> {
  const db = await getDb();
  const docs = await db
    .collection<PageDoc>("pages")
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();
  return docs.map(toPage);
}

export async function updatePageRecord(
  pageId: string,
  patch: Partial<Pick<DbPage, "slug" | "title" | "visibility" | "updated_at">>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const db = await getDb();
  await db
    .collection<PageDoc>("pages")
    .updateOne({ _id: pageId }, { $set: patch });
}

export async function incrementViewCount(pageId: string): Promise<void> {
  const db = await getDb();
  await db
    .collection<PageDoc>("pages")
    .updateOne({ _id: pageId }, { $inc: { view_count: 1 } });
}

export async function deletePageRecord(pageId: string): Promise<void> {
  const db = await getDb();
  await db.collection<PageDoc>("pages").deleteOne({ _id: pageId });
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export async function createApiKey(
  id: string,
  userId: string,
  keyHash: string,
  label: string | null,
): Promise<void> {
  const db = await getDb();
  await db.collection<ApiKeyDoc>("api_keys").insertOne({
    _id: id,
    user_id: userId,
    key_hash: keyHash,
    label,
    created_at: new Date().toISOString(),
    last_used_at: null,
  });
}

export async function getApiKeysByUser(userId: string): Promise<DbApiKey[]> {
  const db = await getDb();
  const docs = await db
    .collection<ApiKeyDoc>("api_keys")
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();
  return docs.map(toApiKey);
}

export async function findApiKeyByHash(
  keyHash: string,
): Promise<DbApiKey | null> {
  const db = await getDb();
  const doc = await db
    .collection<ApiKeyDoc>("api_keys")
    .findOne({ key_hash: keyHash });
  return doc ? toApiKey(doc) : null;
}

export async function touchApiKey(id: string): Promise<void> {
  const db = await getDb();
  await db
    .collection<ApiKeyDoc>("api_keys")
    .updateOne({ _id: id }, { $set: { last_used_at: new Date().toISOString() } });
}

export async function deleteApiKey(id: string, userId: string): Promise<void> {
  const db = await getDb();
  await db
    .collection<ApiKeyDoc>("api_keys")
    .deleteOne({ _id: id, user_id: userId });
}
