import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { logError } from "@/lib/logger";
import { oauthError, oauthJson, preflight, readForm } from "@/lib/oauth/http";
import { exchangeAuthorizationCode, exchangeRefreshToken, OAuthTokenError } from "@/lib/oauth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The OAuth token endpoint: authorization_code and refresh_token grants, public clients. */
export async function POST(req: Request) {
  const limited = await checkRateLimit(`oauth_token__ip__${getClientIp(req.headers)}`, 30);
  if (limited) return oauthError("slow_down", "Too many requests.", 429);

  const form = await readForm(req);
  if (!form) return oauthError("invalid_request", "Send application/x-www-form-urlencoded.");

  try {
    if (form.grant_type === "authorization_code") return oauthJson(await exchangeAuthorizationCode(form));
    if (form.grant_type === "refresh_token") return oauthJson(await exchangeRefreshToken(form));
    return oauthError("unsupported_grant_type", "Supported grant types: authorization_code, refresh_token.");
  } catch (e) {
    if (e instanceof OAuthTokenError) return oauthError(e.code, e.message);
    logError("oauth/token", "Token exchange failed", e);
    return oauthError("server_error", "Something went wrong.", 500);
  }
}

export const OPTIONS = preflight;
