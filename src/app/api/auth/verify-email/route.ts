import { NextResponse } from "next/server";
import { consumeEmailVerificationToken, getUserById, markEmailVerified } from "@/lib/db/auth";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { hashVerificationToken } from "@/server/verification";

export const runtime = "nodejs";

const INVALID = { error: "This link is invalid or has expired. Send a new one from Account settings." } as const;

/**
 * Confirms an email address. A POST from the button on /verify-email, not
 * the link itself: mail scanners open links, and a GET that verified would
 * let one confirm an address nobody at that address had seen.
 *
 * The caller must be signed in to the account the link belongs to. The link
 * alone is not enough: anyone can register an address they do not own, and
 * its real owner, seeing the mail, could confirm an account whose password
 * someone else chose. Requiring the session means confirming takes both the
 * mailbox and the password. An owner who has neither password nor session
 * recovers through Forgot password, which replaces the password and signs
 * everyone else out.
 */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const rl = await checkRateLimit(`verify-email__ip__${getClientIp(req.headers)}`, 10);
  if (rl) return rl;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to this account first, then open the link again." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = body?.token;
  if (typeof token !== "string" || !token || token.length > 128) {
    return NextResponse.json(INVALID, { status: 400 });
  }

  const record = await consumeEmailVerificationToken(await hashVerificationToken(token));
  if (!record) return NextResponse.json(INVALID, { status: 400 });

  // The link confirms the address it was sent to, nothing else.
  const user = await getUserById(record.user_id);
  if (!user || user.id !== session.userId || user.email !== record.email) return NextResponse.json(INVALID, { status: 400 });

  await markEmailVerified(user.id);
  return NextResponse.json({ ok: true });
}
