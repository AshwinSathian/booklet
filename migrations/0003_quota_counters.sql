-- Daily quota counters for Cloudflare free-tier enforcement.
-- One row per resource type, reset by comparing `period` (YYYY-MM-DD UTC).
CREATE TABLE IF NOT EXISTS quota_counters (
  resource  TEXT NOT NULL PRIMARY KEY,
  count     INTEGER NOT NULL DEFAULT 0,
  period    TEXT NOT NULL  -- YYYY-MM-DD UTC date of current window
);
