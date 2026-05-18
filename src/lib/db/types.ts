export type UserPlan = "free" | "pro" | "teams";

export type DbUser = {
  id: string;           // Clerk user ID
  email: string | null;
  plan: UserPlan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_expires_at: string | null;
  created_at: string;
};

export type DbPage = {
  id: string;           // 10-char KV key
  user_id: string;
  slug: string | null;
  title: string | null;
  visibility: "public" | "unlisted";
  collection_id: string | null;
  view_count: number;
  remove_attribution_badge: boolean;
  created_at: string;
  updated_at: string;
};

export type DbCollection = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
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
};

export type PageVersion = {
  id: string;
  page_id: string;
  version_number: number;
  doc_snapshot: string;
  created_at: string;
  size_bytes: number;
};

export type PublishEvent = {
  id: string;
  user_id: string | null;       // null = anonymous
  page_id: string;
  is_update: boolean;           // true = re-publish to existing page
  content_length_bucket: "xs" | "sm" | "md" | "lg" | "xl";
  source: "browser" | "api" | "cli";
  created_at: string;
};
