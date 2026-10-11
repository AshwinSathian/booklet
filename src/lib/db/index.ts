import { getDb } from "@/lib/mongodb";
import type { DbApiKey, DbCollection, DbCollectionMember, DbPage, DbPageLink, DbUser, DbWebhook, DbWebhookDelivery, CollectionMemberRole } from "./types";

// ---------------------------------------------------------------------------
// Internal document shapes (MongoDB _id = our string id)
// ---------------------------------------------------------------------------

type UserDoc = Omit<DbUser, "id"> & { _id: string };
// `slug` is optional here (unlike the public DbPage.slug: string | null
// contract) because it must be OMITTED, not set to null, when absent — the
// unique index on `slug` is sparse, which only excludes documents where the
// field is genuinely missing. A present `slug: null` is still an indexed
// value, so a second slug-less page would collide with the first. See
// createPageRecord/updatePageRecord.
type PageDoc = Omit<DbPage, "id" | "slug"> & { _id: string; slug?: string | null };
type ApiKeyDoc = Omit<DbApiKey, "id"> & { _id: string };
// Same sparse-index reasoning as PageDoc — see createCollectionRecord/updateCollectionRecord.
type CollectionDoc = Omit<DbCollection, "id" | "slug"> & { _id: string; slug?: string | null };
type CollectionMemberDoc = Omit<DbCollectionMember, "id"> & { _id: string };
type WebhookDoc = Omit<DbWebhook, "id"> & { _id: string };

function toUser(doc: UserDoc): DbUser {
  const { _id, ...rest } = doc;
  return {
    id: _id,
    ...rest,
    password_hash: rest.password_hash ?? null,
    display_name: rest.display_name ?? null,
  };
}

function toPage(doc: PageDoc): DbPage {
  const { _id, ...rest } = doc;
  return {
    id: _id,
    ...rest,
    slug: rest.slug ?? null,
    collection_id: rest.collection_id ?? null,
    team_id: rest.team_id ?? null,
    password_hash: rest.password_hash ?? null,
    frontmatter_meta: rest.frontmatter_meta ?? null,
    taken_down_at: rest.taken_down_at ?? null,
    doc_type: rest.doc_type ?? null,
  };
}

function toApiKey(doc: ApiKeyDoc): DbApiKey {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function toCollection(doc: CollectionDoc): DbCollection {
  const { _id, ...rest } = doc;
  return {
    id: _id,
    ...rest,
    slug: rest.slug ?? null,
    is_team_space: rest.is_team_space ?? false,
    parent_id: rest.parent_id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUser(id: string): Promise<DbUser | null> {
  const db = await getDb();
  const doc = await db.collection<UserDoc>("users").findOne({ _id: id });
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
  teamId: string | null = null,
  frontmatterMeta: Record<string, unknown> | null = null,
  // Unlisted unless the author opts in: reachable by link, absent from
  // /explore, tag pages, the sitemap and search engines.
  visibility: DbPage["visibility"] = "unlisted",
  extra: { collectionId?: string | null; docType?: DbPage["doc_type"] } = {},
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection<PageDoc>("pages").insertOne({
    _id: pageId,
    user_id: userId,
    // slug intentionally omitted — see PageDoc's comment above.
    title,
    visibility,
    doc_type: extra.docType ?? null,
    collection_id: extra.collectionId ?? null,
    team_id: teamId,
    view_count: 0,
    password_hash: null,
    frontmatter_meta: frontmatterMeta,
    taken_down_at: null,
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

// Escapes regex metacharacters in a user-supplied query string before it's
// used to build a MongoDB $regex filter — the query is title-search input,
// not a pattern the caller should be able to author.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Titles are clamped to 64 chars at creation (see doc-title.ts's clamp()), so
// nothing legitimate ever needs a longer search query — this is a single
// choke-point guard against an oversized regex/filter value reaching Mongo,
// same pattern as the other size guards in this codebase (e.g. blocks.ts's
// MAX_BLOCK_DEPTH/MAX_BLOCK_COUNT), not a behavior-affecting limit for any
// real title.
const MAX_SEARCH_FILTER_LENGTH = 200;

export async function getPagesByUser(
  userId: string,
  opts: {
    limit?: number;
    query?: string;
    tag?: string;
    type?: string;
    /**
     * List this team space instead of the user's own pages: every page in
     * it, whoever owns it. The caller must have checked membership.
     */
    spaceId?: string;
    /** Keyset position: return only pages sorted after this one. */
    after?: { created_at: string; id: string };
  } = {},
): Promise<{ pages: DbPage[]; total: number }> {
  const db = await getDb();
  const col = db.collection<PageDoc>("pages");
  const filter: Record<string, unknown> = opts.spaceId
    ? { collection_id: opts.spaceId, taken_down_at: null }
    : { user_id: userId };
  if (opts.type) filter.doc_type = opts.type;
  const trimmedQuery = opts.query?.trim().slice(0, MAX_SEARCH_FILTER_LENGTH);
  if (trimmedQuery) filter.title = { $regex: escapeRegExp(trimmedQuery), $options: "i" };
  const trimmedTag = opts.tag?.trim().slice(0, MAX_SEARCH_FILTER_LENGTH);
  if (trimmedTag) filter["frontmatter_meta.tags"] = trimmedTag;
  // `total` counts every match; the keyset condition only narrows the page.
  const pageFilter = opts.after
    ? {
        ...filter,
        $or: [
          { created_at: { $lt: opts.after.created_at } },
          { created_at: opts.after.created_at, _id: { $lt: opts.after.id } },
        ],
      }
    : filter;
  const [docs, total] = await Promise.all([
    col
      .find(pageFilter)
      .sort({ created_at: -1, _id: -1 })
      .limit(opts.limit ?? 0)
      .toArray(),
    col.countDocuments(filter),
  ]);
  return { pages: docs.map(toPage), total };
}

export async function updatePageRecord(
  pageId: string,
  patch: Partial<Pick<DbPage, "slug" | "title" | "visibility" | "doc_type" | "collection_id" | "team_id" | "password_hash" | "frontmatter_meta" | "updated_at">>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const db = await getDb();

  // slug=null means "clear the custom slug" — must $unset, not $set to
  // null, or the sparse unique index collides (see PageDoc's comment).
  const { slug, ...rest } = patch;
  const update: { $set?: typeof patch; $unset?: { slug: "" } } = {};
  if (Object.keys(rest).length > 0) update.$set = rest;
  if ("slug" in patch) {
    if (slug === null) {
      update.$unset = { slug: "" };
    } else {
      update.$set = { ...update.$set, slug };
    }
  }

  await db.collection<PageDoc>("pages").updateOne({ _id: pageId }, update);
}

/**
 * Mirrors a takedown onto the `pages` record (if the page has one) and
 * makes a public page unlisted, so it also drops out of every listing query
 * — /explore, tag pages, profiles, team spaces and the sitemap all filter on
 * `visibility: "public"`. A team-only page stays team-only: making it
 * unlisted would widen who can read it if the takedown were ever reversed.
 */
export async function markPageTakenDown(pageId: string, at: string): Promise<void> {
  // One update, so a page can never be left taken down and still public.
  await (await getDb()).collection<PageDoc>("pages").updateOne({ _id: pageId }, [
    {
      $set: {
        taken_down_at: at,
        visibility: { $cond: [{ $eq: ["$visibility", "public"] }, "unlisted", "$visibility"] },
      },
    },
  ]);
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
    slug: d.slug ?? null,
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

/** Every page its author made public and left open: what a search engine may be told about. */
export async function getPublicPagesForSitemap(limit = 5000): Promise<Array<{ key: string; updated_at: string }>> {
  const db = await getDb();
  const docs = await db
    .collection<PageDoc>("pages")
    .find({ visibility: "public", password_hash: null, taken_down_at: null })
    .sort({ updated_at: -1 })
    .limit(limit)
    .project<Pick<PageDoc, "_id" | "slug" | "updated_at">>({ _id: 1, slug: 1, updated_at: 1 })
    .toArray();
  return docs.map((d) => ({ key: d.slug ?? d._id, updated_at: d.updated_at }));
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
    .find({ collection_id: collectionId, visibility: "public", password_hash: null })
    .sort({ created_at: -1 })
    .limit(200)
    .project<ExploreProjection>(EXPLORE_PROJECTION)
    .toArray();
  return docs.map(toExploreItem);
}

/**
 * Every page in a team space that has not been taken down, for the space
 * home. `publicOnly` is what a visitor who is not a member gets.
 *
 * ponytail: capped at 500 with no paging; page the space home when a space
 * outgrows it.
 */
export async function getSpacePages(collectionId: string, publicOnly: boolean): Promise<DbPage[]> {
  const db = await getDb();
  const docs = await db
    .collection<PageDoc>("pages")
    .find({
      collection_id: collectionId,
      taken_down_at: null,
      ...(publicOnly ? { visibility: "public" as const, password_hash: null } : {}),
    })
    .sort({ created_at: -1 })
    .limit(500)
    .toArray();
  return docs.map(toPage);
}

/** Whether a space has a page its Atom feed would carry. One indexed lookup, no pages loaded. */
export async function hasPublicSpacePage(collectionId: string): Promise<boolean> {
  const db = await getDb();
  const doc = await db
    .collection<PageDoc>("pages")
    .findOne({ collection_id: collectionId, taken_down_at: null, visibility: "public", password_hash: null }, { projection: { _id: 1 } });
  return doc !== null;
}

// ---------------------------------------------------------------------------
// Published links between pages (`[[Title]]` resolved at publish)
// ---------------------------------------------------------------------------

/**
 * Published pages a `[[Title]]` in a page may point at: the other pages of
 * the same team space, or, outside a space, the author's own pages. Titles
 * match exactly, ignoring case.
 */
export async function findLinkTargets(
  scope: { spaceId: string } | { userId: string },
  titles: string[],
): Promise<DbPage[]> {
  if (titles.length === 0) return [];
  const db = await getDb();
  const docs = await db
    .collection<PageDoc>("pages")
    .find({
      ...("spaceId" in scope ? { collection_id: scope.spaceId } : { user_id: scope.userId }),
      taken_down_at: null,
      title: { $in: titles.map((t) => new RegExp(`^${escapeRegExp(t.slice(0, MAX_SEARCH_FILTER_LENGTH))}$`, "i")) },
    })
    // The oldest page wins when two share a title, so a link does not move
    // to a newer page of the same name.
    .sort({ created_at: 1 })
    .limit(500)
    .toArray();
  return docs.map(toPage);
}

/** Replaces the outgoing links of `sourceId` with `targetIds`. */
export async function setPageLinks(sourceId: string, targetIds: string[]): Promise<void> {
  const links = (await getDb()).collection<DbPageLink>("page_links");
  await links.deleteMany({ source_id: sourceId });
  if (targetIds.length) {
    await links.insertMany([...new Set(targetIds)].map((target_id) => ({ source_id: sourceId, target_id })));
  }
}

/** Pages that link to `targetId`, newest first. Not filtered by who may see them. */
export async function getBacklinkPages(targetId: string): Promise<DbPage[]> {
  const db = await getDb();
  const rows = await db.collection<DbPageLink>("page_links").find({ target_id: targetId }).limit(200).toArray();
  if (rows.length === 0) return [];
  const docs = await db
    .collection<PageDoc>("pages")
    .find({ _id: { $in: rows.map((r) => r.source_id) }, taken_down_at: null })
    .sort({ created_at: -1 })
    .toArray();
  return docs.map(toPage);
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

/** Several collections in one query, by id. Ids that match nothing are absent from the map. */
export async function getCollectionsByIds(ids: string[]): Promise<Map<string, DbCollection>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const db = await getDb();
  const docs = await db.collection<CollectionDoc>("collections").find({ _id: { $in: unique } }).toArray();
  return new Map(docs.map((d) => [d._id, toCollection(d)]));
}

/** Which of these collections the user has a membership row in. The owner has none: check `user_id` for that. */
export async function getMemberCollectionIds(collectionIds: string[], userId: string): Promise<Set<string>> {
  if (collectionIds.length === 0) return new Set();
  const db = await getDb();
  const docs = await db
    .collection<CollectionMemberDoc>("collection_members")
    .find({ user_id: userId, collection_id: { $in: collectionIds } })
    .project<{ collection_id: string }>({ collection_id: 1 })
    .toArray();
  return new Set(docs.map((d) => d.collection_id));
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
  parentId: string | null = null,
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.collection<CollectionDoc>("collections").insertOne({
    _id: collectionId,
    user_id: userId,
    name,
    // slug intentionally omitted — see CollectionDoc's comment above.
    is_team_space: isTeamSpace,
    parent_id: parentId,
    created_at: now,
    updated_at: now,
  });
}

export async function getCollectionChildren(collectionId: string): Promise<DbCollection[]> {
  const db = await getDb();
  const docs = await db
    .collection<CollectionDoc>("collections")
    .find({ parent_id: collectionId })
    .sort({ name: 1 })
    .toArray();
  return docs.map(toCollection);
}

export async function getCollectionBySlug(slug: string): Promise<DbCollection | null> {
  const db = await getDb();
  const doc = await db.collection<CollectionDoc>("collections").findOne({ slug, is_team_space: true });
  return doc ? toCollection(doc) : null;
}

export async function updateCollectionRecord(
  collectionId: string,
  patch: Partial<Pick<DbCollection, "name" | "slug" | "is_team_space" | "parent_id" | "updated_at">>,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const db = await getDb();

  // Same sparse-index reasoning as updatePageRecord — clearing a slug must
  // $unset it, not $set it to null.
  const { slug, ...rest } = patch;
  const update: { $set?: typeof patch; $unset?: { slug: "" } } = {};
  if (Object.keys(rest).length > 0) update.$set = rest;
  if ("slug" in patch) {
    if (slug === null) {
      update.$unset = { slug: "" };
    } else {
      update.$set = { ...update.$set, slug };
    }
  }

  await db.collection<CollectionDoc>("collections").updateOne({ _id: collectionId }, update);
}

export async function deleteCollectionRecord(collectionId: string, userId: string): Promise<void> {
  const db = await getDb();
  const children = await getCollectionChildren(collectionId);
  for (const child of children) {
    await db
      .collection<PageDoc>("pages")
      .updateMany({ user_id: userId, collection_id: child.id }, { $set: { collection_id: null } });
    await db.collection<CollectionDoc>("collections").deleteOne({ _id: child.id, user_id: userId });
  }
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
  // Callers parse `userId`/`collectionId` out of a JSON body via an `as`
  // cast, which only lies to the type checker — at runtime a value like
  // `{"$ne": null}` would sail through as an object and turn this filter
  // into a query operator (NoSQL injection) instead of an equality match.
  // Guard here too, not just at the route boundary, so this stays safe even
  // if a future caller forgets the check.
  if (typeof collectionId !== "string" || typeof userId !== "string") {
    throw new Error("removeCollectionMember: collectionId and userId must be strings");
  }
  const db = await getDb();
  const removed = await db
    .collection<CollectionMemberDoc>("collection_members")
    .findOneAndDelete({ collection_id: collectionId, user_id: userId });
  // An invite link works for 72 hours and more than once, so the one this
  // member joined by would let them straight back in. Invites are for one
  // address each, so only theirs are cancelled: other people's unused
  // links keep working. Whole seconds, plus one: a token's issue time has
  // no finer grain.
  const email = (removed?.email ?? (await db.collection<UserDoc>("users").findOne({ _id: userId }))?.email)?.toLowerCase();
  if (!email) return;
  await db
    .collection<CollectionDoc>("collections")
    .updateOne(
      { _id: collectionId },
      { $push: { invite_revocations: { email, at: new Date((Math.floor(Date.now() / 1000) + 1) * 1000).toISOString() } } },
    );
}

/**
 * The role an owner gave an address before its owner had a confirmed
 * account (a `pending:<email>` row), removing that row. Null if there is none.
 */
export async function claimPendingMember(collectionId: string, email: string): Promise<CollectionMemberRole | null> {
  const db = await getDb();
  const pending = await db
    .collection<CollectionMemberDoc>("collection_members")
    .findOneAndDelete({ collection_id: collectionId, user_id: `pending:${email}` });
  return pending?.role ?? null;
}

export async function getCollectionMember(collectionId: string, userId: string): Promise<DbCollectionMember | null> {
  const db = await getDb();
  const doc = await db.collection<CollectionMemberDoc>("collection_members").findOne({ collection_id: collectionId, user_id: userId });
  return doc ? toCollectionMember(doc) : null;
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

type ViewDedupeDoc = { session_hash: string; page_id: string; created_at: string; expires_at: Date };

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
    {
      $setOnInsert: {
        session_hash: sessionHash,
        page_id: pageId,
        created_at: new Date().toISOString(),
        // BSON Date for the TTL index — see the analytics_events write site
        // (src/app/api/analytics/view/route.ts) for why this is separate
        // from the string `created_at`.
        expires_at: new Date(),
      },
    },
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

/**
 * Deletes every record keyed by page_id outside of the page/doc/version
 * collections themselves (analytics, publish
 * events, links to and from the page) — call this alongside deletePageRecord/deletePageVersions so a
 * deleted page doesn't leave orphaned rows behind. Best-effort: callers
 * already treat page deletion as complete once the doc/record/versions are
 * gone, so a failure here is logged by the caller, not fatal to the delete.
 */
export async function deletePageAssociatedRecords(pageId: string): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.collection("analytics_events").deleteMany({ page_id: pageId }),
    db.collection("publish_events").deleteMany({ page_id: pageId }),
    db.collection("page_links").deleteMany({ $or: [{ source_id: pageId }, { target_id: pageId }] }),
    // A delivery's stored body carries the page's title and URL.
    db.collection("webhook_deliveries").deleteMany({ page_id: pageId }),
  ]);
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
  const { deletedCount } = await db.collection<WebhookDoc>("webhooks").deleteOne({ _id: id, user_id: userId });
  if (deletedCount) await db.collection("webhook_deliveries").deleteMany({ webhook_id: id });
}

/** The webhook, if this user owns it. */
export async function getWebhook(id: string, userId: string): Promise<DbWebhook | null> {
  const db = await getDb();
  const doc = await db.collection<WebhookDoc>("webhooks").findOne({ _id: id, user_id: userId });
  return doc ? toWebhook(doc) : null;
}

export const MAX_DELIVERIES_PER_WEBHOOK = 50;

type WebhookDeliveryDoc = Omit<DbWebhookDelivery, "id"> & { _id: string };

/** Stores a delivery attempt and drops all but the newest 50 for its webhook. */
export async function recordWebhookDelivery(delivery: DbWebhookDelivery): Promise<void> {
  const db = await getDb();
  const coll = db.collection<WebhookDeliveryDoc>("webhook_deliveries");
  const { id, ...rest } = delivery;
  await coll.insertOne({ _id: id, ...rest });
  const stale = await coll
    .find({ webhook_id: delivery.webhook_id })
    .sort({ created_at: -1, _id: -1 })
    .skip(MAX_DELIVERIES_PER_WEBHOOK)
    .project<{ _id: string }>({ _id: 1 })
    .toArray();
  if (stale.length) await coll.deleteMany({ _id: { $in: stale.map((d) => d._id) } });
}

/** Newest first. Scoped to the owner as well as the webhook, so a caller cannot read another account's log by id. */
export async function getWebhookDeliveries(webhookId: string, userId: string): Promise<DbWebhookDelivery[]> {
  const db = await getDb();
  const docs = await db
    .collection<WebhookDeliveryDoc>("webhook_deliveries")
    .find({ webhook_id: webhookId, user_id: userId })
    .sort({ created_at: -1, _id: -1 })
    .limit(MAX_DELIVERIES_PER_WEBHOOK)
    .toArray();
  return docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
}

export async function getWebhookDelivery(id: string, webhookId: string, userId: string): Promise<DbWebhookDelivery | null> {
  const db = await getDb();
  const doc = await db
    .collection<WebhookDeliveryDoc>("webhook_deliveries")
    .findOne({ _id: id, webhook_id: webhookId, user_id: userId });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export async function touchWebhookTriggered(id: string): Promise<void> {
  const db = await getDb();
  await db.collection<WebhookDoc>("webhooks").updateOne(
    { _id: id },
    { $set: { last_triggered_at: new Date().toISOString() } },
  );
}
