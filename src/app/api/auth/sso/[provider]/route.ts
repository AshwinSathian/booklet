import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { deleteIdentity } from "@/lib/db/auth";
import { SSO_PROVIDERS, type SsoProvider } from "@/lib/db/types";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { getSession } from "@/lib/auth/session";
import { getSsoProvider, ssoAuthorizeUrl } from "@/lib/auth/sso";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { isSafeRedirect } from "@/lib/safe-redirect";
import { getSiteOrigin } from "@/lib/site-url";
import { countSignInMethods } from "@/server/sso";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

export const SSO_COOKIE = "booklet_sso";

type Ctx = { params: Promise<{ provider: string }> };

/**
 * Starts a provider sign-in: remembers the state, the PKCE verifier and
 * where to go afterwards in a short-lived cookie, then sends the browser to
 * the provider. With `?connect=1` and a session, the callback links the
 * provider to that account instead of signing in.
 */
export async function GET(req: Request, { params }: Ctx) {
  const provider = getSsoProvider((await params).provider);
  if (!provider) return new Response("Not found", { status: 404 });

  const limited = await checkRateLimit(`sso_start__ip__${getClientIp(req.headers)}`, 20);
  if (limited) return limited;

  const url = new URL(req.url);
  const redirect = url.searchParams.get("redirect_url");
  const connect = url.searchParams.get("connect") === "1" ? ((await getSession())?.userId ?? null) : null;

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const origin = getSiteOrigin(req);
  const res = NextResponse.redirect(
    ssoAuthorizeUrl(
      provider,
      `${origin}/api/auth/sso/${provider.id}/callback`,
      state,
      createHash("sha256").update(verifier).digest("base64url"),
    ),
  );
  res.cookies.set(
    SSO_COOKIE,
    JSON.stringify({ provider: provider.id, state, verifier, redirect: isSafeRedirect(redirect) ? redirect : null, connect }),
    {
      httpOnly: true,
      secure: req.headers.get("x-forwarded-proto") === "https",
      // Lax, not Strict: the provider sends the browser back with a
      // cross-site navigation, and the callback must see this cookie.
      sameSite: "lax",
      path: "/api/auth/sso",
      maxAge: 600,
    },
  );
  return res;
}

/** Disconnects a provider from the signed-in account, unless it is the only way left to sign in. */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!isSameOriginRequest(req) || !req.headers.get("origin")) {
    return problem(403, "Invalid request origin");
  }
  const session = await getSession();
  if (!session) return problem(401, "Not signed in");

  const { provider } = await params;
  if (!(SSO_PROVIDERS as readonly string[]).includes(provider)) return problem(404, "Not found");

  // ponytail: count-then-delete, so two simultaneous removals of the last
  // two methods can both pass. Recovery is the password-reset email.
  if ((await countSignInMethods(session.userId)) <= 1) {
    return problem(409, "This is the only way to sign in to this account. Set a password or add a passkey first.");
  }
  await deleteIdentity(session.userId, provider as SsoProvider);
  return NextResponse.json({ ok: true });
}
