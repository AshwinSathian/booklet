import { getDb } from "@/lib/mongodb";
import type { DbApiKey, DbCollection, DbCollectionMember, DbPage, DbUser, UserPlan, CollectionMemberRole } from "./types";

// ---------------------------------------------------------------------------
// Internal document shapes (MongoDB _id = our string id)
// ---------------------------------------------------------------------------

type UserDoc = Omit<DbUser, "id"> & { _id: string };
type PageDoc = Omit<DbPage, "id"> & { _id: string };
type ApiKeyDoc = Omit<DbApiKey, "id"> & { _id: string };
type CollectionDoc = Omit<DbCollection, "id"> & { _id: string };
type CollectionMemberDoc = Omit<DbCollectionMember, "id"> & { _id: string };

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
    password_hash: rest.password_hash ?? null,
  };
}

function toApiKey(doc: ApiKeyDoc): DbApiKey {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function toCollection(doc: CollectionDoc): DbCollection {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest, is_team_space: rest.is_team_space ?? false };
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
        plan: "free" as UserPlan,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        plan_expires_at: null,
        created_at: new Date().toISOString(),
      },
    },
    { upsert: true },
  );
}

export async function getUserPlan(userId: string): Promise<UserPlan> {
  const user = await getUser(userId);
  return user?.plan ?? "free";
}

export async function setUserPlan(
  userId: string,
  plan: UserPlan,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
): Promise<void> {
  const db = await getDb();
  await db.collection<UserDoc>("users").updateOne(
    { _id: userId },
    {
      $set: {
        plan,
        ...(stripeCustomerId !== undefined ? { stripe_customer_id: stripeCustomerId } : {}),
        ...(stripeSubscriptionId !== undefined ? { stripe_subscription_id: stripeSubscriptionId } : {}),
      },
    },
  );
}

export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<DbUser | null> {
  const db = await getDb();
  const doc = await db.collection<UserDoc>("users").findOne({ stripe_customer_id: stripeCustomerId });
  return doc ? toUser(doc) : null;
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
  removeAttributionBadge = false,
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
    view_count: 0,
    remove_attribution_badge: removeAttributionBadge,
    password_hash: null,
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
  patch: Partial<Pick<DbPage, "slug" | "title" | "visibility" | "collection_id" | "remove_attribution_badge" | "password_hash" | "updated_at">>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const db = await getDb();
  await db
    .collection<PageDoc>("pages")
    .updateOne({ _id: pageId }, { $set: patch });
}

export type ExploreItem = Pick<DbPage, "id" | "slug" | "title" | "view_count" | "created_at">;

export async function getRecentPublicPages(limit = 48): Promise<ExploreItem[]> {
  const db = await getDb();
  const docs = await db
    .collection<PageDoc>("pages")
    .find({ visibility: "public", password_hash: null })
    .sort({ created_at: -1 })
    .limit(limit)
    .project<Pick<PageDoc, "_id" | "slug" | "title" | "view_count" | "created_at">>({
      _id: 1,
      slug: 1,
      title: 1,
      view_count: 1,
      created_at: 1,
    })
    .toArray();
  return docs.map((d) => ({
    id: d._id,
    slug: d.slug,
    title: d.title,
    view_count: d.view_count,
    created_at: d.created_at,
  }));
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
    is_team_space: isTeamSpace,
    created_at: now,
    updated_at: now,
  });
}

export async function updateCollectionRecord(
  collectionId: string,
  patch: Partial<Pick<DbCollection, "name" | "is_team_space" | "updated_at">>,
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
