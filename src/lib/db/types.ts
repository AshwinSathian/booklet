import type { DocType } from "booklet-api-client";

export type UserPlan = "free";

export type DbUser = {
  id: string;                     // app-owned
  // Nullable: user rows created before the in-house auth have no email.
  email: string | null;
  password_hash: string | null;   // argon2id hash (src/lib/auth/password.ts); null = user row created before the in-house auth
  display_name: string | null;
  plan: UserPlan;
  created_at: string;
  /** ISO time the address in `email` was proven to reach this person. Absent or null = not verified. */
  email_verified_at?: string | null;
};

export const SSO_PROVIDERS = ["github", "google"] as const;
export type SsoProvider = (typeof SSO_PROVIDERS)[number];

/** A sign-in identity at an outside provider, linked to one user. */
export type DbUserIdentity = {
  id: string;
  user_id: string;
  provider: SsoProvider;
  provider_user_id: string;
  /** The verified address the provider reported when the identity was linked. */
  email: string;
  created_at: string;
};

export type DbPasskey = {
  id: string;                 // credential ID, base64url
  user_id: string;
  public_key: string;         // COSE public key, base64url
  counter: number;
  transports: string[] | null;
  name: string;
  created_at: string;
  last_used_at: string | null;
};

export type DbSession = {
  id: string;
  user_id: string;
  token_hash: string;   // HMAC-SHA256(raw token, SESSION_TOKEN_PEPPER) — see src/lib/auth/session-token.ts
  created_at: string;
  expires_at: Date;     // BSON Date — TTL index, sliding 30-day window
};

export type DbPasswordResetToken = {
  id: string;
  user_id: string;
  token_hash: string;   // HMAC-SHA256(raw token, PASSWORD_RESET_TOKEN_PEPPER)
  created_at: string;
  expires_at: Date;     // BSON Date — TTL index, 30-minute window
};

export type DbPage = {
  id: string;           // 10-char KV key
  user_id: string;
  slug: string | null;
  title: string | null;
  /** "team": only members of the team space in `collection_id` (and the owner) can read it. */
  visibility: "public" | "unlisted" | "team";
  /** From frontmatter `type`. Absent on records written before 2026-10. */
  doc_type?: DocType | null;
  collection_id: string | null;
  team_id: string | null;         // null = personal page
  view_count: number;
  password_hash: string | null;   // PBKDF2-SHA256 hash (see src/lib/password.ts); null = no password
  frontmatter_meta: Record<string, unknown> | null;  // parsed YAML frontmatter fields
  taken_down_at: string | null;   // ISO timestamp of an admin takedown; mirrors docs.taken_down_at
  created_at: string;
  updated_at: string;
};

export const REPORT_REASONS = ["spam", "phishing", "malware", "illegal", "harassment", "copyright", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type DbReport = {
  id: string;
  page_id: string;
  reason: ReportReason;
  detail: string | null;
  reporter_email: string | null;
  created_at: string;
  status: "open" | "actioned" | "dismissed";
};

/** A resolved `[[Title]]` link from one published page to another. */
export type DbPageLink = {
  source_id: string;
  target_id: string;
};

export type DbCollection = {
  id: string;
  user_id: string;   // owner
  name: string;
  slug: string | null;   // only set for team spaces; used for /t/[slug] routing
  is_team_space: boolean;
  parent_id: string | null;   // null = top-level folder; else id of a top-level collection (2-level cap)
  /**
   * Team spaces: one entry per removed member. An invite link for `email`
   * issued before `at` (ISO time) no longer works.
   */
  invite_revocations?: Array<{ email: string; at: string }>;
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
  source: "browser" | "api" | "cli" | "github-action" | "mcp";
  created_at: string;
  // Distinct "rich block" kinds (callout, toggle, columns, ...) present in
  // this publish — see src/lib/block-usage.ts. Optional/absent on events
  // recorded before this field existed; empty array means none present.
  rich_block_kinds?: string[];
};

