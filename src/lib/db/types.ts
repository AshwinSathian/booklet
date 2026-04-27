export type DbUser = {
  id: string;           // Clerk user ID
  email: string | null;
  is_pro: 0 | 1;
  stripe_customer_id: string | null;
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
