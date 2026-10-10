import { getDb } from "@/lib/mongodb";
import { getD1, type D1Statement } from "@/lib/d1";
import type { DbApiKey, DbCollection, DbCollectionMember, DbPage, DbUser, DbWebhook, CollectionMemberRole } from "./types";

// Spike state: users, pages, API keys and webhooks read and write D1.
// Collections and their members are still MongoDB (not ported in the spike).

type PageRow = Omit<DbPage, "frontmatter_meta"> & { frontmatter_meta: string | null };
type CollectionDoc = Omit<DbCollection, "id" | "slug"> & { _id: string; slug?: string | null };
type CollectionMemberDoc = Omit<DbCollectionMember, "id"> & { _id: string };

function toPage(row: PageRow): DbPage {
  return {
    ...row,
    frontmatter_meta: row.frontmatter_meta ? (JSON.parse(row.frontmatter_meta) as Record<string, unknown>) : null,
  };
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

function tagsOf(meta: Record<string, unknown> | null | undefined): string[] {
  const tags = meta?.tags;
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.filter((t): t is string => typeof t === "string"))];
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUser(id: string): Promise<DbUser | null> {
  return getD1().prepare("SELECT * FROM users WHERE id = ?").bind(id).first<DbUser>();
}

export async function upsertUser(
  id: string,
  email: string | null,
): Promise<void> {
  await getD1()
    .prepare(
      "INSERT INTO users (id, email, plan, created_at) VALUES (?, ?, 'free', ?) ON CONFLICT (id) DO UPDATE SET email = excluded.email",
    )
    .bind(id, email, new Date().toISOString())
    .run();
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  return getD1().prepare("SELECT * FROM users WHERE email = ?").bind(email.toLowerCase()).first<DbUser>();
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function tagStatements(pageId: string, meta: Record<string, unknown> | null | undefined): D1Statement[] {
  const db = getD1();
  return [
    db.prepare("DELETE FROM page_tags WHERE page_id = ?").bind(pageId),
    ...tagsOf(meta).map((tag) => db.prepare("INSERT INTO page_tags (page_id, tag) VALUES (?, ?)").bind(pageId, tag)),
  ];
}

export async function createPageRecord(
  pageId: string,
  userId: string,
  title: string | null = null,
  teamId: string | null = null,
  frontmatterMeta: Record<string, unknown> | null = null,
  // Unlisted unless the author opts in: reachable by link, absent from
  // /explore, tag pages, the sitemap and search engines.
  visibility: DbPage["visibility"] = "unlisted",
): Promise<void> {
  const db = getD1();
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO pages (id, user_id, title, visibility, team_id, frontmatter_meta, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(pageId, userId, title, visibility, teamId, frontmatterMeta ? JSON.stringify(frontmatterMeta) : null, now, now),
    ...tagStatements(pageId, frontmatterMeta),
  ]);
}

export async function getPageRecord(pageId: string): Promise<DbPage | null> {
  const row = await getD1().prepare("SELECT * FROM pages WHERE id = ?").bind(pageId).first<PageRow>();
  return row ? toPage(row) : null;
}

export async function getPageBySlug(slug: string): Promise<DbPage | null> {
  const row = await getD1().prepare("SELECT * FROM pages WHERE slug = ?").bind(slug).first<PageRow>();
  return row ? toPage(row) : null;
}

// Titles are clamped to 64 chars at creation (see doc-title.ts's clamp()), so
// nothing legitimate ever needs a longer search query.
const MAX_SEARCH_FILTER_LENGTH = 200;

export async function getPagesByUser(
  userId: string,
  opts: { limit?: number; offset?: number; query?: string; tag?: string } = {},
): Promise<{ pages: DbPage[]; total: number }> {
  const where = ["p.user_id = ?"];
  const args: unknown[] = [userId];
  const trimmedQuery = opts.query?.trim().slice(0, MAX_SEARCH_FILTER_LENGTH);
  if (trimmedQuery) {
    // instr, not LIKE: D1 rejects a LIKE pattern over 50 bytes ("LIKE or
    // GLOB pattern too complex"), and instr needs no wildcard escaping.
    // lower() folds ASCII only; MongoDB's $regex "i" also folded non-ASCII
    // letters. Recorded in the ADR as a behavior change.
    where.push("instr(lower(p.title), lower(?)) > 0");
    args.push(trimmedQuery);
  }
  const trimmedTag = opts.tag?.trim().slice(0, MAX_SEARCH_FILTER_LENGTH);
  if (trimmedTag) {
    where.push("EXISTS (SELECT 1 FROM page_tags t WHERE t.page_id = p.id AND t.tag = ?)");
    args.push(trimmedTag);
  }
  const clause = where.join(" AND ");
  const db = getD1();
  // limit 0 meant "no limit" to MongoDB; -1 means that to SQLite.
  const [rows, count] = await db.batch([
    db
      .prepare(`SELECT p.* FROM pages p WHERE ${clause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`)
      .bind(...args, opts.limit || -1, opts.offset ?? 0),
    db.prepare(`SELECT COUNT(*) AS n FROM pages p WHERE ${clause}`).bind(...args),
  ]);
  return {
    pages: (rows.results as unknown as PageRow[]).map(toPage),
    total: (count.results[0] as { n: number }).n,
  };
}

const PAGE_PATCH_COLUMNS = ["slug", "title", "visibility", "collection_id", "team_id", "password_hash", "frontmatter_meta", "updated_at"] as const;

export async function updatePageRecord(
  pageId: string,
  patch: Partial<Pick<DbPage, "slug" | "title" | "visibility" | "collection_id" | "team_id" | "password_hash" | "frontmatter_meta" | "updated_at">>,
): Promise<void> {
  // Column names come from the fixed list above, never from the caller.
  const columns = PAGE_PATCH_COLUMNS.filter((c) => c in patch);
  if (columns.length === 0) return;
  const db = getD1();
  const values = columns.map((c) =>
    c === "frontmatter_meta" ? (patch.frontmatter_meta ? JSON.stringify(patch.frontmatter_meta) : null) : (patch[c] ?? null),
  );
  await db.batch([
    db.prepare(`UPDATE pages SET ${columns.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).bind(...values, pageId),
    ...("frontmatter_meta" in patch ? tagStatements(pageId, patch.frontmatter_meta) : []),
  ]);
}

/**
 * Mirrors a takedown onto the `pages` record (if the page has one) and
 * forces it unlisted, so it also drops out of every listing query —
 * /explore, tag pages, profiles, team spaces and the sitemap all filter on
 * `visibility: "public"`.
 */
export async function markPageTakenDown(pageId: string, at: string): Promise<void> {
  await getD1().prepare("UPDATE pages SET taken_down_at = ?, visibility = 'unlisted' WHERE id = ?").bind(at, pageId).run();
}

export type ExploreItem = Pick<DbPage, "id" | "slug" | "title" | "view_count" | "created_at"> & {
  tags: string[] | null;
};

type ExploreRow = Pick<DbPage, "id" | "slug" | "title" | "view_count" | "created_at"> & { frontmatter_meta: string | null };

const EXPLORE_COLUMNS = "p.id, p.slug, p.title, p.view_count, p.created_at, p.frontmatter_meta";
const EXPLORE_FILTER = "p.visibility = 'public' AND p.password_hash IS NULL";

function toExploreItem(r: ExploreRow): ExploreItem {
  const tags = tagsOf(r.frontmatter_meta ? (JSON.parse(r.frontmatter_meta) as Record<string, unknown>) : null);
  return { id: r.id, slug: r.slug, title: r.title, view_count: r.view_count, created_at: r.created_at, tags: tags.length ? tags : null };
}

async function explore(sql: string, ...args: unknown[]): Promise<ExploreItem[]> {
  const { results } = await getD1().prepare(sql).bind(...args).all<ExploreRow>();
  return results.map(toExploreItem);
}

export async function getPublicPagesByUser(userId: string, limit = 100): Promise<ExploreItem[]> {
  return explore(
    `SELECT ${EXPLORE_COLUMNS} FROM pages p WHERE p.user_id = ? AND ${EXPLORE_FILTER} ORDER BY p.created_at DESC LIMIT ?`,
    userId,
    limit,
  );
}

export async function getRecentPublicPages(limit = 48): Promise<ExploreItem[]> {
  return explore(`SELECT ${EXPLORE_COLUMNS} FROM pages p WHERE ${EXPLORE_FILTER} ORDER BY p.created_at DESC LIMIT ?`, limit);
}

export async function getPagesByTag(tag: string, limit = 100): Promise<ExploreItem[]> {
  return explore(
    `SELECT ${EXPLORE_COLUMNS} FROM page_tags t JOIN pages p ON p.id = t.page_id
     WHERE t.tag = ? AND ${EXPLORE_FILTER} ORDER BY p.created_at DESC LIMIT ?`,
    tag,
    limit,
  );
}

export async function getDistinctTags(limit = 200): Promise<Array<{ tag: string; count: number }>> {
  const { results } = await getD1()
    .prepare(
      `SELECT t.tag AS tag, COUNT(*) AS count FROM page_tags t JOIN pages p ON p.id = t.page_id
       WHERE ${EXPLORE_FILTER} GROUP BY t.tag ORDER BY count DESC LIMIT ?`,
    )
    .bind(limit)
    .all<{ tag: string; count: number }>();
  return results;
}

export async function getPagesByCollection(collectionId: string): Promise<ExploreItem[]> {
  return explore(
    `SELECT ${EXPLORE_COLUMNS} FROM pages p WHERE p.collection_id = ? AND p.visibility = 'public' ORDER BY p.created_at DESC LIMIT 200`,
    collectionId,
  );
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

async function unfilePages(userId: string, collectionId: string): Promise<void> {
  await getD1()
    .prepare("UPDATE pages SET collection_id = NULL WHERE user_id = ? AND collection_id = ?")
    .bind(userId, collectionId)
    .run();
}

export async function deleteCollectionRecord(collectionId: string, userId: string): Promise<void> {
  const db = await getDb();
  const children = await getCollectionChildren(collectionId);
  for (const child of children) {
    await unfilePages(userId, child.id);
    await db.collection<CollectionDoc>("collections").deleteOne({ _id: child.id, user_id: userId });
  }
  await unfilePages(userId, collectionId);
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

/**
 * Increments view_count at most once per (sessionHash, pageId), so a single
 * visitor's reloads, prefetches, or a bot re-fetching the same URL don't
 * keep inflating the counter.
 *
 * INSERT OR IGNORE reports whether this session was new for the page; only
 * then is the counter bumped.
 */
export async function incrementViewCount(pageId: string, sessionHash: string): Promise<void> {
  const db = getD1();
  const res = await db
    .prepare("INSERT OR IGNORE INTO view_dedupe (session_hash, page_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(sessionHash, pageId, new Date().toISOString(), Date.now() + 7_776_000_000)
    .run();
  if (res.meta.changes === 0) return;

  await db.prepare("UPDATE pages SET view_count = view_count + 1 WHERE id = ?").bind(pageId).run();
}

export async function deletePageRecord(pageId: string): Promise<void> {
  const db = getD1();
  await db.batch([
    db.prepare("DELETE FROM pages WHERE id = ?").bind(pageId),
    db.prepare("DELETE FROM page_tags WHERE page_id = ?").bind(pageId),
  ]);
}

/**
 * Deletes every record keyed by page_id outside of the page/doc/version
 * tables themselves (analytics, publish events).
 */
export async function deletePageAssociatedRecords(pageId: string): Promise<void> {
  const db = getD1();
  await db.batch([
    db.prepare("DELETE FROM analytics_events WHERE page_id = ?").bind(pageId),
    db.prepare("DELETE FROM publish_events WHERE page_id = ?").bind(pageId),
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
  await getD1()
    .prepare("INSERT INTO api_keys (id, user_id, key_hash, label, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, userId, keyHash, label, new Date().toISOString())
    .run();
}

export async function getApiKeysByUser(userId: string): Promise<DbApiKey[]> {
  const { results } = await getD1()
    .prepare("SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC")
    .bind(userId)
    .all<DbApiKey>();
  return results;
}

export async function findApiKeyByHash(
  keyHash: string,
): Promise<DbApiKey | null> {
  return getD1().prepare("SELECT * FROM api_keys WHERE key_hash = ?").bind(keyHash).first<DbApiKey>();
}

export async function touchApiKey(id: string): Promise<void> {
  await getD1().prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
}

export async function deleteApiKey(id: string, userId: string): Promise<void> {
  await getD1().prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?").bind(id, userId).run();
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

type WebhookRow = Omit<DbWebhook, "events"> & { events: string };

export async function getWebhooksByUser(userId: string): Promise<DbWebhook[]> {
  const { results } = await getD1()
    .prepare("SELECT * FROM webhooks WHERE user_id = ? ORDER BY created_at DESC")
    .bind(userId)
    .all<WebhookRow>();
  return results.map((r) => ({ ...r, events: JSON.parse(r.events) as DbWebhook["events"] }));
}

export async function createWebhook(
  id: string,
  userId: string,
  url: string,
  secret: string,
  events: DbWebhook["events"],
): Promise<void> {
  await getD1()
    .prepare("INSERT INTO webhooks (id, user_id, url, secret, events, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, userId, url, secret, JSON.stringify(events), new Date().toISOString())
    .run();
}

export async function deleteWebhook(id: string, userId: string): Promise<void> {
  await getD1().prepare("DELETE FROM webhooks WHERE id = ? AND user_id = ?").bind(id, userId).run();
}

export async function touchWebhookTriggered(id: string): Promise<void> {
  await getD1().prepare("UPDATE webhooks SET last_triggered_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
}
