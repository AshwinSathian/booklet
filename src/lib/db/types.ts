export type DbUser = {
  id: string;           // Clerk user ID
  email: string | null;
  created_at: string;
};

export type DbPage = {
  id: string;           // 10-char KV key
  user_id: string;
  slug: string | null;
  title: string | null;
  visibility: "public" | "unlisted";
  view_count: number;
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
  event: "view" | "read_50" | "read_100" | "exit";
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
