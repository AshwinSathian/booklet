import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { oauthError, oauthJson, preflight } from "@/lib/oauth/http";
import { registerClient } from "@/lib/oauth/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dynamic client registration (RFC 7591), for MCP clients that do not
 * publish a Client ID Metadata Document. Open to anyone, as the MCP
 * authorization spec expects: a registration grants nothing by itself. It
 * only names the redirect URIs a later consent screen will show the user.
 */
export async function POST(req: Request) {
  const limited = await checkRateLimit(`oauth_register__ip__${getClientIp(req.headers)}`, 10);
  if (limited) return oauthError("slow_down", "Too many requests.", 429);

  const text = await req.text();
  let body: unknown = null;
  try {
    body = text.length <= 20_000 ? JSON.parse(text) : null;
  } catch {
    /* handled below */
  }

  const client = await registerClient(body);
  if (!client) {
    return oauthError(
      "invalid_redirect_uri",
      "redirect_uris must be 1 to 10 URIs that are https, http on loopback, or an app's private scheme.",
    );
  }

  return oauthJson(
    {
      client_id: client.client_id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: client.client_name ?? undefined,
      redirect_uris: client.redirect_uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    201,
  );
}

export const OPTIONS = preflight;
