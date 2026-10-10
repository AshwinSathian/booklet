import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { oauthError, oauthJson, preflight, readForm } from "@/lib/oauth/http";
import { revokeToken } from "@/lib/oauth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Token revocation (RFC 7009). Revoking either token of a grant ends the grant. */
export async function POST(req: Request) {
  const limited = await checkRateLimit(`oauth_revoke__ip__${getClientIp(req.headers)}`, 30);
  if (limited) return oauthError("slow_down", "Too many requests.", 429);

  const form = await readForm(req);
  if (!form?.token) return oauthError("invalid_request", "token is required.");
  await revokeToken(form.token);
  // Always 200, whether or not the token existed (RFC 7009 section 2.2).
  return oauthJson({});
}

export const OPTIONS = preflight;
