import { getDb } from "@/lib/mongodb";
import type { DbApiKey, DbCollection, DbCollectionMember, DbPage, DbUser, DbWebhook, CollectionMemberRole } from "./types";

// ---------------------------------------------------------------------------
// Internal document shapes (MongoDB _id = our string id)
// ---------------------------------------------------------------------------

type UserDoc = Omit<DbUser, "id"> & { _id: string };
type PageDoc = Omit<DbPage, "id"> & { _id: string };
type ApiKeyDoc = Omit<DbApiKey, "id"> & { _id: string };
type CollectionDoc = Omit<DbCollection, "id"> & { _id: string };
type CollectionMemberDoc = Omit<DbCollectionMember, "id"> & { _id: string };
type WebhookDoc = Omit<DbWebhook, "id"> & { _id: string };

function toUser(doc: UserDoc): DbUser {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function toPage(doc: PageDoc): DbPage {
  const { _id, ...rest } = doc;
  return {
    id: _id,
    ...rest,
    collection_id: rest.collection_id ?? null,
    team_id: rest.team_id ?? null,
    password_hash: rest.password_hash ?? null,
    featured: rest.featured ?? false,
    frontmatter_meta: rest.frontmatter_meta ?? null,
  };
}

function toApiKey(doc: ApiKeyDoc): DbApiKey {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function toCollection(doc: CollectionDoc): DbCollection {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest, slug: rest.slug ?? null, is_team_space: rest.is_team_space ?? false };
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
      $setOnInsert: {
        _id: id,
        plan: "free" as const,
        created_at: new Date().toISOString(),
      },
    },
    { upsert: true },
  );
}


export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const db = await getDb();
  const doc = await db.collection<UserDoc>("users").findOne({ email: email.toLowerCase() });
  return doc ? toUser(doc) : null;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export async function createPageRecord(
  pageId: string,
  userId: string,
  title: string | null = null,
  teamId: string | null = null,
  frontmatterMeta: Record<string, unknown> | null = null,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection<PageDoc>("pages").insertOne({
    _id: pageId,
    user_id: userId,
    slug: null,
    title,
    visibility: "public",
    collection_id: null,
    team_id: teamId,
    view_count: 0,
    remove_attribution_badge: false,
    password_hash: null,
    featured: false,
    frontmatter_meta: frontmatterMeta,
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

export async function getPagesByUser(
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ pages: DbPage[]; total: number }> {
  const db = await getDb();
  const col = db.collection<PageDoc>("pages");
  const filter = { user_id: userId };
  const [docs, total] = await Promise.all([
    col
      .find(filter)
      .sort({ created_at: -1 })
      .skip(opts.offset ?? 0)
      .limit(opts.limit ?? 0)
      .toArray(),
    col.countDocuments(filter),
  ]);
  return { pages: docs.map(toPage), total };
}

export async function updatePageRecord(
  pageId: string,
  patch: Partial<Pick<DbPage, "slug" | "title" | "visibility" | "collection_id" | "team_id" | "remove_attribution_badge" | "password_hash" | "featured" | "frontmatter_meta" | "updated_at">>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const db = await getDb();
  await db
    .collection<PageDoc>("pages")
    .updateOne({ _id: pageId }, { $set: patch });
}

export async function getPublicPagesByUser(userId: string, limit = 100): Promise<ExploreItem[]> {
  const db = await getDb();
  const docs = await db
    .collection<PageDoc>("pages")
    .find({ user_id: userId, visibility: "public", password_hash: null })
    .sort({ created_at: -1 })
    .limit(limit)
    .project<ExploreProjection>(EXPLORE_PROJECTION)
    .toArray();
  return docs.map(toExploreItem);
}

export type ExploreItem = Pick<DbPage, "id" | "slug" | "title" | "view_count" | "created_at"> & {
  tags: string[] | null;
};

type ExploreProjection = Pick<PageDoc, "_id" | "slug" | "title" | "view_count" | "created_at" | "frontmatter_meta">;

function extractTags(meta: Record<string, unknown> | null | undefined): string[] | null {
  const tags = meta?.tags;
  if (!Array.isArray(tags) || tags.length === 0) return null;
  const strings = tags.filter((t): t is string => typeof t === "string");
  return strings.length > 0 ? strings : null;
}

const EXPLORE_PROJECTION = { _id: 1, slug: 1, title: 1, view_count: 1, created_at: 1, frontmatter_meta: 1 } as const;

function toExploreItem(d: ExploreProjection): ExploreItem {
  return {
    id: d._id,
    slug: d.slug,
    title: d.title,
    view_count: d.view_count,
    created_at: d.created_at,
    tags: extractTags(d.frontmatter_meta),
  };
}

export async function getRecentPublicPages(limit = 48): Promise<ExploreItem[]> {
  const db = await getDb();
  const docs = await db
    .collection<PageDoc>("pages")
    .find({ visibility: "public", password_hash: null })
    .sort({ created_at: -1 })
    .limit(limit)
    .project<ExploreProjection>(EXPLORE_PROJECTION)
    .toArray();
  return docs.map(toExploreItem);
}

export async function getFeaturedPages(limit = 50): Promise<ExploreItem[]> {
  const db = await getDb();
  const docs = await db
    .collection<PageDoc>("pages")
    .find({ featured: true, visibility: "public", password_hash: null })
    .sort({ created_at: -1 })
    .limit(limit)
    .project<ExploreProjection>(EXPLORE_PROJECTION)
    .toArray();
  return docs.map(toExploreItem);
}

export async function getPagesByTag(tag: string, limit = 100): Promise<ExploreItem[]> {
  const db = await getDb();
  const docs = await db
    .collection<PageDoc>("pages")
    .find({
      "frontmatter_meta.tags": tag,
      visibility: "public",
      password_hash: null,
    })
    .sort({ created_at: -1 })
    .limit(limit)
    .project<ExploreProjection>(EXPLORE_PROJECTION)
    .toArray();
  return docs.map(toExploreItem);
}

export async function getDistinctTags(limit = 200): Promise<Array<{ tag: string; count: number }>> {
  const db = await getDb();
  const result = await db
    .collection<PageDoc>("pages")
    .aggregate<{ _id: string; count: number }>([
      { $match: { visibility: "public", password_hash: null, "frontmatter_meta.tags": { $exists: true, $ne: [] } } },
      { $unwind: "$frontmatter_meta.tags" },
      { $group: { _id: "$frontmatter_meta.tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ])
    .toArray();
  return result.map((r) => ({ tag: String(r._id), count: r.count }));
}

export async function getPagesByCollection(collectionId: string): Promise<ExploreItem[]> {
  const db = await getDb();
  const docs = await db
    .collection<PageDoc>("pages")
    .find({ collection_id: collectionId, visibility: "public" })
    .sort({ created_at: -1 })
    .limit(200)
    .project<ExploreProjection>(EXPLORE_PROJECTION)
    .toArray();
  return docs.map(toExploreItem);
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function getCollectionsByUser(userId: string): Promise<DbCollection[]> {
  const db = await getDb();
  const docs = await db
    .collection<CollectionDoc>("collections")
    .find({ user_id: userId })
    .sort({ name: 1 })
    .toArray();
  return docs.map(toCollection);
}

export async function getCollectionRecord(collectionId: string): Promise<DbCollection | null> {
  const db = await getDb();
  const doc = await db.collection<CollectionDoc>("collections").findOne({ _id: collectionId });
  return doc ? toCollection(doc) : null;
}

function toCollectionMember(doc: CollectionMemberDoc): DbCollectionMember {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest, email: rest.email ?? null };
}

export async function createCollectionRecord(
  collectionId: string,
  userId: string,
  name: string,
  isTeamSpace = false,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection<CollectionDoc>("collections").insertOne({
    _id: collectionId,
    user_id: userId,
    name,
    slug: null,
    is_team_space: isTeamSpace,
    created_at: now,
    updated_at: now,
  });
}

export async function getCollectionBySlug(slug: string): Promise<DbCollection | null> {
  const db = await getDb();
  const doc = await db.collection<CollectionDoc>("collections").findOne({ slug, is_team_space: true });
  return doc ? toCollection(doc) : null;
}

export async function updateCollectionRecord(
  collectionId: string,
  patch: Partial<Pick<DbCollection, "name" | "slug" | "is_team_space" | "updated_at">>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const db = await getDb();
  await db
    .collection<CollectionDoc>("collections")
    .updateOne({ _id: collectionId }, { $set: patch });
}

export async function deleteCollectionRecord(collectionId: string, userId: string): Promise<void> {
  const db = await getDb();
  await db
    .collection<PageDoc>("pages")
    .updateMany({ user_id: userId, collection_id: collectionId }, { $set: { collection_id: null } });
  await db.collection<CollectionDoc>("collections").deleteOne({ _id: collectionId, user_id: userId });
}

// ---------------------------------------------------------------------------
// Team Space members
// ---------------------------------------------------------------------------

export async function getCollectionMembers(collectionId: string): Promise<DbCollectionMember[]> {
  const db = await getDb();
  const docs = await db
    .collection<CollectionMemberDoc>("collection_members")
    .find({ collection_id: collectionId })
    .sort({ created_at: 1 })
    .toArray();
  return docs.map(toCollectionMember);
}

export async function addCollectionMember(
  id: string,
  collectionId: string,
  userId: string,
  email: string | null,
  role: CollectionMemberRole,
  invitedBy: string,
): Promise<void> {
  const db = await getDb();
  await db.collection<CollectionMemberDoc>("collection_members").updateOne(
    { collection_id: collectionId, user_id: userId },
    {
      $set: { email, role, invited_by: invitedBy },
      $setOnInsert: { _id: id, collection_id: collectionId, user_id: userId, created_at: new Date().toISOString() },
    },
    { upsert: true },
  );
}

export async function removeCollectionMember(collectionId: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.collection<CollectionMemberDoc>("collection_members").deleteOne({ collection_id: collectionId, user_id: userId });
}

export async function getCollectionMemberships(userId: string): Promise<{ collection_id: string; role: CollectionMemberRole }[]> {
  const db = await getDb();
  const docs = await db
    .collection<CollectionMemberDoc>("collection_members")
    .find({ user_id: userId })
    .project<Pick<CollectionMemberDoc, "collection_id" | "role">>({ collection_id: 1, role: 1 })
    .toArray();
  return docs.map((d) => ({ collection_id: d.collection_id, role: d.role }));
}

export async function getTeamSpacesByMembership(userId: string): Promise<DbCollection[]> {
  const memberships = await getCollectionMemberships(userId);
  if (memberships.length === 0) return [];
  const ids = memberships.map((m) => m.collection_id);
  const db = await getDb();
  const docs = await db
    .collection<CollectionDoc>("collections")
    .find({ _id: { $in: ids }, is_team_space: true })
    .sort({ name: 1 })
    .toArray();
  return docs.map(toCollection);
}

type ViewDedupeDoc = { session_hash: string; page_id: string; created_at: string };

/**
 * Increments view_count at most once per (sessionHash, pageId) — mirroring
 * analytics_events' session-scoped dedupe (same session_hash derivation,
 * see src/lib/session-hash.ts) so a single visitor's reloads, prefetches,
 * or a bot re-fetching the same URL don't keep inflating the counter.
 * Two different visitors (different session hashes) viewing the same page
 * both count, same as before.
 *
 * `updateOne`'s `upsertedCount` tells us atomically whether this is the
 * first time this session has been recorded against this page — only then
 * do we bump the real counter.
 */
export async function incrementViewCount(pageId: string, sessionHash: string): Promise<void> {
  const db = await getDb();

  const dedupeResult = await db.collection<ViewDedupeDoc>("view_dedupe").updateOne(
    { session_hash: sessionHash, page_id: pageId },
    { $setOnInsert: { session_hash: sessionHash, page_id: pageId, created_at: new Date().toISOString() } },
    { upsert: true },
  );
  if (dedupeResult.upsertedCount === 0) return;

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

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

function toWebhook(doc: WebhookDoc): DbWebhook {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest, last_triggered_at: rest.last_triggered_at ?? null };
}

export async function getWebhooksByUser(userId: string): Promise<DbWebhook[]> {
  const db = await getDb();
  const docs = await db
    .collection<WebhookDoc>("webhooks")
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .toArray();
  return docs.map(toWebhook);
}

export async function createWebhook(
  id: string,
  userId: string,
  url: string,
  secret: string,
  events: DbWebhook["events"],
): Promise<void> {
  const db = await getDb();
  await db.collection<WebhookDoc>("webhooks").insertOne({
    _id: id,
    user_id: userId,
    url,
    secret,
    events,
    created_at: new Date().toISOString(),
    last_triggered_at: null,
  });
}

export async function deleteWebhook(id: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.collection<WebhookDoc>("webhooks").deleteOne({ _id: id, user_id: userId });
}

export async function touchWebhookTriggered(id: string): Promise<void> {
  const db = await getDb();
  await db.collection<WebhookDoc>("webhooks").updateOne(
    { _id: id },
    { $set: { last_triggered_at: new Date().toISOString() } },
  );
}
