-- Spike schema: one table per MongoDB collection (16), plus page_tags, which
-- replaces the multikey index on pages.frontmatter_meta.tags.
-- Timestamps that MongoDB stored as ISO strings stay TEXT. Fields that were
-- BSON Dates behind TTL indexes are INTEGER epoch milliseconds, and an hourly
-- Cron Trigger deletes expired rows (SQLite has no TTL).
-- SQLite UNIQUE treats NULLs as distinct, which is what MongoDB's sparse
-- unique indexes did for a missing field.

CREATE TABLE users (
  id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, display_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free', created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX users_email ON users (email);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX sessions_token_hash ON sessions (token_hash);
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expires ON sessions (expires_at);

CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX prt_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX prt_user ON password_reset_tokens (user_id);
CREATE INDEX prt_expires ON password_reset_tokens (expires_at);

CREATE TABLE pages (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, slug TEXT, title TEXT,
  visibility TEXT NOT NULL DEFAULT 'unlisted', collection_id TEXT, team_id TEXT,
  view_count INTEGER NOT NULL DEFAULT 0, password_hash TEXT,
  frontmatter_meta TEXT, taken_down_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX pages_user_created ON pages (user_id, created_at DESC);
CREATE INDEX pages_collection_user ON pages (collection_id, user_id);
CREATE UNIQUE INDEX pages_slug ON pages (slug);
-- Explore: visibility = 'public' AND password_hash IS NULL, newest first.
CREATE INDEX pages_explore ON pages (visibility, password_hash, created_at DESC);
CREATE INDEX pages_collection_vis ON pages (collection_id, visibility, created_at DESC);

-- Tag pages: join on tag, then the explore filter on pages.
CREATE TABLE page_tags (
  page_id TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY (page_id, tag)
);
CREATE INDEX page_tags_tag ON page_tags (tag, page_id);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, key_hash TEXT NOT NULL,
  label TEXT, created_at TEXT NOT NULL, last_used_at TEXT
);
CREATE INDEX api_keys_user ON api_keys (user_id, created_at DESC);
CREATE UNIQUE INDEX api_keys_hash ON api_keys (key_hash);

CREATE TABLE docs (
  id TEXT PRIMARY KEY, doc TEXT NOT NULL,
  expires_at INTEGER, claim_token_hash TEXT, taken_down_at TEXT
);
CREATE INDEX docs_expires ON docs (expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE reports (
  id TEXT PRIMARY KEY, page_id TEXT NOT NULL, reason TEXT NOT NULL, detail TEXT,
  reporter_email TEXT, created_at TEXT NOT NULL, status TEXT NOT NULL, resolved_at TEXT
);
CREATE INDEX reports_status ON reports (status, created_at DESC);
CREATE INDEX reports_page ON reports (page_id, status);

CREATE TABLE rate_limits (
  id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX rate_limits_expires ON rate_limits (expires_at);

CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY, page_id TEXT NOT NULL, event TEXT NOT NULL,
  referrer_bucket TEXT, country TEXT, session_hash TEXT NOT NULL,
  created_at TEXT NOT NULL, expires_at INTEGER
);
CREATE INDEX analytics_page ON analytics_events (page_id, created_at DESC);
CREATE UNIQUE INDEX analytics_dedupe ON analytics_events (session_hash, page_id, event);
CREATE INDEX analytics_expires ON analytics_events (expires_at);

CREATE TABLE page_versions (
  id TEXT PRIMARY KEY, page_id TEXT NOT NULL, version_number INTEGER NOT NULL,
  doc_snapshot TEXT NOT NULL, created_at TEXT NOT NULL, size_bytes INTEGER NOT NULL
);
CREATE UNIQUE INDEX page_versions_number ON page_versions (page_id, version_number);

CREATE TABLE collections (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, slug TEXT,
  is_team_space INTEGER NOT NULL DEFAULT 0, parent_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
-- MongoDB treated a null parent_id as a value here, so two top-level folders
-- with one name collided. COALESCE keeps that; a plain UNIQUE would not.
CREATE UNIQUE INDEX collections_name ON collections (user_id, COALESCE(parent_id, ''), name);
CREATE UNIQUE INDEX collections_slug ON collections (slug);

CREATE TABLE collection_members (
  id TEXT PRIMARY KEY, collection_id TEXT NOT NULL, user_id TEXT NOT NULL,
  email TEXT, role TEXT NOT NULL, invited_by TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX collection_members_pair ON collection_members (collection_id, user_id);
CREATE INDEX collection_members_user ON collection_members (user_id);

CREATE TABLE webhooks (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, url TEXT NOT NULL, secret TEXT NOT NULL,
  events TEXT NOT NULL, created_at TEXT NOT NULL, last_triggered_at TEXT
);
CREATE INDEX webhooks_user ON webhooks (user_id, created_at DESC);

CREATE TABLE view_dedupe (
  session_hash TEXT NOT NULL, page_id TEXT NOT NULL, created_at TEXT NOT NULL,
  expires_at INTEGER, PRIMARY KEY (session_hash, page_id)
);
CREATE INDEX view_dedupe_expires ON view_dedupe (expires_at);

CREATE TABLE publish_events (
  id TEXT PRIMARY KEY, user_id TEXT, page_id TEXT NOT NULL, is_update INTEGER NOT NULL,
  content_length_bucket TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL,
  rich_block_kinds TEXT
);
CREATE INDEX publish_events_page ON publish_events (page_id);

-- data holds the whole DraftDoc as JSON; the columns exist for listing.
CREATE TABLE drafts (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT,
  created_at TEXT, updated_at TEXT, data TEXT NOT NULL
);
CREATE INDEX drafts_user ON drafts (user_id, updated_at DESC);
