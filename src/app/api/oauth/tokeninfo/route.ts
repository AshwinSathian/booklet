import { ACCESS_TOKEN_PATTERN } from "booklet-api-client";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { oauthJson } from "@/lib/oauth/http";
import { verifyAccessToken } from "@/lib/oauth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What an access token is good for, asked by presenting the token itself.
 * The MCP server calls this to decide whether a request carries a live
 * token that was issued for it. Says nothing about who the user is.
 */
export async function GET(req: Request) {
  const limited = await checkRateLimit(`oauth_tokeninfo__ip__${getClientIp(req.headers)}`, 600);
  if (limited) return limited;

  const raw = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const token = ACCESS_TOKEN_PATTERN.test(raw) ? await verifyAccessToken(raw) : null;
  if (!token) return oauthJson({ active: false }, 401);

  return oauthJson({
    active: true,
    client_id: token.clientId,
    scope: token.scope.join(" "),
    exp: Math.floor(token.expiresAt.getTime() / 1000),
    resource: token.resource,
  });
}
