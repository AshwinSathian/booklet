/**
 * Resolves the bearer credential on a /api/v1 request. Two kinds exist:
 * an API key, which carries every scope (its last_used_at is updated as a
 * side-effect, non-fatal if it fails), and an OAuth access token issued to
 * an MCP client, which carries the scopes the user granted.
 */

import { findApiKeyByHash, touchApiKey } from "@/lib/db";
import { hashApiKey, isApiKeyFormat } from "./api-key";
import { ACCESS_TOKEN_PATTERN, type OAuthScope } from "booklet-api-client";
import { verifyAccessToken } from "./oauth/server";

export type Scope = OAuthScope;

/** `scopes: null` means unrestricted (an API key). */
export type BearerAuth = { userId: string; scopes: Scope[] | null };

export async function resolveBearer(req: Request): Promise<BearerAuth | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;

  const raw = auth.slice("Bearer ".length).trim();

  // ponytail: the MCP server forwards the caller's token here, so a token
  // issued for the MCP server is also accepted by this API directly. Both
  // are Booklet and the scopes are the same; give the MCP server its own
  // credential if the two ever need different audiences.
  if (ACCESS_TOKEN_PATTERN.test(raw)) {
    const token = await verifyAccessToken(raw);
    return token ? { userId: token.userId, scopes: token.scope } : null;
  }

  if (!isApiKeyFormat(raw)) return null;

  const keyHash = await hashApiKey(raw);
  const record = await findApiKeyByHash(keyHash);
  if (!record) return null;

  // Touch last_used_at non-blocking.
  void touchApiKey(record.id).catch(() => {});

  return { userId: record.user_id, scopes: null };
}
