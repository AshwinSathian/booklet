import { getUserById } from "@/lib/db/auth";
import { logError } from "@/lib/logger";
import { sendVerification } from "@/server/verification";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { getSiteOrigin } from "@/lib/site-url";
import { toErrorResponse, problem } from "@/server/errors";
import { passkeyLoginOptions, verifyPasskeyLogin, WEBAUTHN_COOKIE } from "@/server/passkeys";

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
 * Signs in with a passkey, in two calls: an empty body returns the options
 * for the browser, and a body with `response` starts a session for the
 * passkey's owner.
 */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return problem(403, "Invalid request origin");
  }
  const limited = await checkRateLimit(`passkey_login__ip__${getClientIp(req.headers)}`, 20);
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as { response?: AuthenticationResponseJSON } | null;
  const origin = getSiteOrigin(req);
  try {
    if (!body?.response) {
      const { options, challengeId } = await passkeyLoginOptions(origin);
      return challengeCookie(req, NextResponse.json(options), challengeId);
    }
    const store = await cookies();
    const challengeId = store.get(WEBAUTHN_COOKIE)?.value;
    store.delete({ name: WEBAUTHN_COOKIE, path: "/api/auth/passkey" });
    const userId = await verifyPasskeyLogin(origin, challengeId, body.response);
    await createSession(userId);
    const user = await getUserById(userId);
    if (user) await sendVerification(user, origin, { onlyIfNoneLive: true }).catch((err) => logError("passkey", "Could not send verification email", err));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return toErrorResponse(e);
  }
}
