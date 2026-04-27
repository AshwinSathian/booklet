/**
 * Resolves an API key from the Authorization header and returns the
 * associated userId, or null if the key is missing/invalid/unknown.
 * Also updates last_used_at as a side-effect (non-fatal if it fails).
 */

import { findApiKeyByHash, touchApiKey } from "@/lib/db";
import { hashApiKey, isApiKeyFormat } from "./api-key";

export async function resolveApiKey(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;

  const raw = auth.slice("Bearer ".length).trim();
  if (!isApiKeyFormat(raw)) return null;

  const keyHash = await hashApiKey(raw);
  const record = await findApiKeyByHash(keyHash);
  if (!record) return null;

  // Touch last_used_at non-blocking.
  void touchApiKey(record.id).catch(() => {});

  return record.user_id;
}
