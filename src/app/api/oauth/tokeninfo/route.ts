import { ACCESS_TOKEN_PATTERN } from "booklet-api-client";
import { oauthJson } from "@/lib/oauth/http";
import { verifyAccessToken } from "@/lib/oauth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What an access token is good for, asked by presenting the token itself.
 * The MCP server calls this to decide whether a request carries a live
 * token that was issued for it. Says nothing about who the user is.
 *
 * Not rate-limited by IP on purpose. Its caller is the MCP server, over
 * loopback, so every user would share one bucket and anyone sending junk
 * tokens to the MCP server could fill it and lock them all out. A token is
 * 40 random characters; guessing one is not a risk a limit would change.
 */
export async function GET(req: Request) {

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
