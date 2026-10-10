import { unverifiedResponse } from "@/server/verification";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { getUserById } from "@/lib/db/auth";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSiteOrigin } from "@/lib/site-url";
import { toErrorResponse } from "@/server/errors";
import { passkeyRegistrationOptions, verifyPasskeyRegistration, WEBAUTHN_COOKIE } from "@/server/passkeys";

export const runtime = "nodejs";

function challengeCookie(req: Request, res: NextResponse, id: string): NextResponse {
  res.cookies.set(WEBAUTHN_COOKIE, id, {
    httpOnly: true,
    secure: req.headers.get("x-forwarded-proto") === "https",
    sameSite: "strict",
    path: "/api/auth/passkey",
    maxAge: 300,
  });
  return res;
}

/**
 * Adds a passkey to the signed-in account, in two calls: an empty body
 * returns the options for the browser, and a body with `response` (what
 * the authenticator produced) stores the passkey.
 */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req) || !req.headers.get("origin")) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const limited = await checkRateLimit(`passkey_register__${session.userId}`, 20);
  if (limited) return limited;

  // A passkey is a way in that outlives a password reset, so it is only
  // given to an account whose address is confirmed.
  const unverified = await unverifiedResponse(session.userId);
  if (unverified) return unverified;

  const body = (await req.json().catch(() => null)) as { response?: RegistrationResponseJSON; name?: unknown } | null;
  const origin = getSiteOrigin(req);
  try {
    if (!body?.response) {
      const user = await getUserById(session.userId);
      if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      const { options, challengeId } = await passkeyRegistrationOptions(user, origin);
      return challengeCookie(req, NextResponse.json(options), challengeId);
    }
    const store = await cookies();
    const challengeId = store.get(WEBAUTHN_COOKIE)?.value;
    store.delete({ name: WEBAUTHN_COOKIE, path: "/api/auth/passkey" });
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : "Passkey";
    await verifyPasskeyRegistration(session.userId, origin, challengeId, body.response, name);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
