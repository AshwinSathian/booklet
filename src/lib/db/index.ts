import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { DbApiKey, DbPage, DbUser } from "./types";

function getDb(): D1Database {
  return getCloudflareContext().env.READABLE_DB;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function getUser(id: string): Promise<DbUser | null> {
  const db = getDb();
  return db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first<DbUser>();
}

export async function upsertUser(
  id: string,
  email: string | null,
): Promise<void> {
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO users (id, email, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email`,
    )
    .bind(id, email, new Date().toISOString())
    .run();
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export async function createPageRecord(
  pageId: string,
  userId: string,
  title: string | null = null,
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO pages (id, user_id, title, visibility, view_count, created_at, updated_at)
       VALUES (?, ?, ?, 'public', 0, ?, ?)`,
    )
    .bind(pageId, userId, title, now, now)
    .run();
}

export async function getPageRecord(pageId: string): Promise<DbPage | null> {
  const db = getDb();
  return db
    .prepare("SELECT * FROM pages WHERE id = ?")
    .bind(pageId)
    .first<DbPage>();
}

export async function getPageBySlug(slug: string): Promise<DbPage | null> {
  const db = getDb();
  return db
    .prepare("SELECT * FROM pages WHERE slug = ?")
    .bind(slug)
    .first<DbPage>();
}

export async function getPagesByUser(userId: string): Promise<DbPage[]> {
  const db = getDb();
  const result = await db
    .prepare(
      "SELECT * FROM pages WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(userId)
    .all<DbPage>();
  return result.results;
}

export async function updatePageRecord(
  pageId: string,
  patch: Partial<Pick<DbPage, "slug" | "title" | "visibility" | "updated_at">>,
): Promise<void> {
  const db = getDb();
  const sets: string[] = [];
  const values: (string | null)[] = [];

  if (patch.slug !== undefined) {
    sets.push("slug = ?");
    values.push(patch.slug);
  }
  if (patch.title !== undefined) {
    sets.push("title = ?");
    values.push(patch.title);
  }
  if (patch.visibility !== undefined) {
    sets.push("visibility = ?");
    values.push(patch.visibility);
  }
  if (patch.updated_at !== undefined) {
    sets.push("updated_at = ?");
    values.push(patch.updated_at);
  }

  if (sets.length === 0) return;

  values.push(pageId);
  await db
    .prepare(`UPDATE pages SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
}

export async function incrementViewCount(pageId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare("UPDATE pages SET view_count = view_count + 1 WHERE id = ?")
    .bind(pageId)
    .run();
}

export async function deletePageRecord(pageId: string): Promise<void> {
  const db = getDb();
  await db.prepare("DELETE FROM pages WHERE id = ?").bind(pageId).run();
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
  const db = getDb();
  await db
    .prepare(
      `INSERT INTO api_keys (id, user_id, key_hash, label, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, keyHash, label, new Date().toISOString())
    .run();
}

export async function getApiKeysByUser(userId: string): Promise<DbApiKey[]> {
  const db = getDb();
  const result = await db
    .prepare(
      "SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
    )
    .bind(userId)
    .all<DbApiKey>();
  return result.results;
}

export async function findApiKeyByHash(
  keyHash: string,
): Promise<DbApiKey | null> {
  const db = getDb();
  return db
    .prepare("SELECT * FROM api_keys WHERE key_hash = ?")
    .bind(keyHash)
    .first<DbApiKey>();
}

export async function touchApiKey(id: string): Promise<void> {
  const db = getDb();
  await db
    .prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), id)
    .run();
}

export async function deleteApiKey(id: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
}
