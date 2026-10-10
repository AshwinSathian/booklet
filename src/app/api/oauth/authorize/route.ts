import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSiteOrigin } from "@/lib/site-url";
import { buildRedirect, issueAuthorizationCode, validateAuthorizeRequest, type AuthorizeParams } from "@/lib/oauth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * The user's answer on the consent screen (src/app/oauth/authorize). Loading
 * that page grants nothing; only this POST does, and it only counts when it
 * comes from the consent screen itself:
 *
 * - `Origin` must be present and be this site. Unlike isSameOriginRequest,
 *   a missing Origin is refused: every browser sends it on a fetch POST,
 *   and nothing else has a reason to call this.
 * - The session cookie is SameSite=Lax, so a cross-site POST would arrive
 *   without it anyway.
 *
 * The request is validated again from scratch. What the page showed is not
 * trusted, because the body comes from the browser.
 */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(origin && host && new URL(origin).host === host);
  } catch {
    /* malformed Origin */
  }
  if (!sameOrigin) return NextResponse.json({ error: "Invalid request origin" }, { status: 403, headers: NO_STORE });

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401, headers: NO_STORE });

  const limited = await checkRateLimit(`oauth_authorize__${session.userId}`, 20);
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as { params?: unknown; decision?: unknown } | null;
  const raw = body?.params && typeof body.params === "object" ? (body.params as Record<string, unknown>) : {};
  const params: AuthorizeParams = Object.fromEntries(
    Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  if (body?.decision !== "approve" && body?.decision !== "deny") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  }

  const issuer = getSiteOrigin(req);
  const validation = await validateAuthorizeRequest(params, issuer);
  if (!validation.ok) {
    // An untrusted client or redirect URI is never redirected to.
    if (!validation.redirect) return NextResponse.json({ error: validation.message }, { status: 400, headers: NO_STORE });
    return NextResponse.json({ redirect: validation.redirect }, { headers: NO_STORE });
  }

  const { request } = validation;
  if (body.decision === "deny") {
    const redirect = buildRedirect(request.redirectUri, issuer, {
      error: "access_denied",
      error_description: "The user declined.",
      state: request.state,
    });
    return NextResponse.json({ redirect }, { headers: NO_STORE });
  }

  const code = await issueAuthorizationCode(request, session.userId);
  return NextResponse.json(
    { redirect: buildRedirect(request.redirectUri, issuer, { code, state: request.state }) },
    { headers: NO_STORE },
  );
}
