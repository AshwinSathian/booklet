/**
 * Resolves the bearer credential on a /api/v1 request: an API key, which
 * carries every scope. Also updates the key's last_used_at as a side-effect
 * (non-fatal if it fails).
 */

import { findApiKeyByHash, touchApiKey } from "@/lib/db";
import { hashApiKey, isApiKeyFormat } from "./api-key";

export const SCOPES = ["pages:read", "pages:write"] as const;
export type Scope = (typeof SCOPES)[number];

/** `scopes: null` means unrestricted (an API key). */
export type BearerAuth = { userId: string; scopes: Scope[] | null };

export async function resolveBearer(req: Request): Promise<BearerAuth | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;

  const raw = auth.slice("Bearer ".length).trim();
  if (!isApiKeyFormat(raw)) return null;

  const keyHash = await hashApiKey(raw);
  const record = await findApiKeyByHash(keyHash);
  if (!record) return null;

  // Touch last_used_at non-blocking.
  void touchApiKey(record.id).catch(() => {});

  return { userId: record.user_id, scopes: null };
}
