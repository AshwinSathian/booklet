export type UserPlan = "free";

export type DbUser = {
  id: string;                     // app-owned; preserved as-is for users migrated off Clerk
  // Nullable for the remainder of the Clerk-removal migration (Phase 1 tightens
  // this to `string` once every signup/login path guarantees it) — see
  // PLAN-backend-auth-migration.md.
  email: string | null;
  password_hash: string | null;   // argon2id hash (src/lib/auth/password.ts); null = pre-Phase-1 user or migrated user pending /claim
  display_name: string | null;
  plan: UserPlan;
  created_at: string;
};

export type DbSession = {
  id: string;
  user_id: string;
  token_hash: string;   // HMAC-SHA256(raw token, SESSION_TOKEN_PEPPER) — see src/lib/auth/session-token.ts
  created_at: string;
  expires_at: Date;     // BSON Date — TTL index, sliding 30-day window
};

export type DbPage = {
  id: string;           // 10-char KV key
  user_id: string;
  slug: string | null;
  title: string | null;
  visibility: "public" | "unlisted";
  collection_id: string | null;
  team_id: string | null;         // null = personal page
  view_count: number;
  remove_attribution_badge: boolean;
  password_hash: string | null;   // PBKDF2-SHA256 hash (see src/lib/password.ts); null = no password
  featured: boolean;              // opt-in: appear on /explore featured section
  frontmatter_meta: Record<string, unknown> | null;  // parsed YAML frontmatter fields
  created_at: string;
  updated_at: string;
};

export type DbCollection = {
  id: string;
  user_id: string;   // owner
  name: string;
  slug: string | null;   // only set for team spaces; used for /t/[slug] routing
  is_team_space: boolean;
  created_at: string;
  updated_at: string;
};

export type CollectionMemberRole = "editor" | "viewer";

export type DbCollectionMember = {
  id: string;
  collection_id: string;
  user_id: string;
  email: string | null;   // stored for display; source of truth is user_id once claimed
  role: CollectionMemberRole;
  invited_by: string;    // user_id of inviter
  created_at: string;
};

export type DbApiKey = {
  id: string;
  user_id: string;
  key_hash: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
};

export type AnalyticsEvent = {
  id: string;
  page_id: string;
  event: "view" | "read_50" | "read_100" | "exit" | "cta_click";
  referrer_bucket: "slack" | "twitter" | "github" | "email" | "direct" | "other";
  country: string | null;
  session_hash: string;
  created_at: string;
  expires_at: Date;
};

export type PageVersion = {
  id: string;
  page_id: string;
  version_number: number;
  doc_snapshot: string;
  created_at: string;
  size_bytes: number;
};

export type DbWebhook = {
  id: string;
  user_id: string;
  url: string;
  secret: string;   // HMAC signing secret — stored in plain text (user-visible)
  events: ("page.published" | "page.updated")[];
  created_at: string;
  last_triggered_at: string | null;
};

export type PublishEvent = {
  id: string;
  user_id: string | null;       // null = anonymous
  page_id: string;
  is_update: boolean;           // true = re-publish to existing page
  content_length_bucket: "xs" | "sm" | "md" | "lg" | "xl";
  // "api" is the fallback bucket for any /api/v1 caller that doesn't send a
  // recognized X-Booklet-Source header (raw curl, an unlisted integration).
  // The 4 first-party clients each send their own value — see
  // src/lib/request-source.ts, which is what actually assigns this field.
  source: "browser" | "api" | "cli" | "github-action" | "vscode" | "mcp";
  created_at: string;
  // Distinct "rich block" kinds (callout, toggle, columns, ...) present in
  // this publish — see src/lib/block-usage.ts. Optional/absent on events
  // recorded before this field existed; empty array means none present.
  rich_block_kinds?: string[];
};

export type DbReaction = {
  page_id: string;
  emoji: string;
  count: number;
};
