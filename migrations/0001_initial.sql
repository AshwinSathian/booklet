-- Readable v2: ownership, pages, and API key tables
-- Run with: wrangler d1 migrations apply readable-db

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,  -- Clerk user ID (user_xxxxxxxx)
  email        TEXT,
  is_pro       INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
  id           TEXT PRIMARY KEY,  -- 10-char random ID matching Cloudflare KV key
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug         TEXT UNIQUE,       -- optional custom slug (pro only)
  visibility   TEXT NOT NULL DEFAULT 'public',  -- 'public' | 'unlisted'
  view_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pages_user_id ON pages(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug) WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY,  -- random UUID
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash     TEXT NOT NULL UNIQUE,  -- SHA-256 hex of the raw key
  label        TEXT,
  created_at   TEXT NOT NULL,
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
