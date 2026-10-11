import { NextResponse } from "next/server";
import { consumeEmailVerificationToken, getUserById, markEmailVerified } from "@/lib/db/auth";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { hashVerificationToken, applyEmailChange } from "@/server/verification";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

const INVALID = "This link is invalid or has expired. Send a new one from Account settings.";

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
    return problem(403, "Invalid request origin");
  }
  const rl = await checkRateLimit(`verify-email__ip__${getClientIp(req.headers)}`, 10);
  if (rl) return rl;

  const session = await getSession();
  if (!session) return problem(401, "Sign in to this account first, then open the link again.");

  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = body?.token;
  if (typeof token !== "string" || !token || token.length > 128) {
    return problem(400, INVALID);
  }

  const record = await consumeEmailVerificationToken(await hashVerificationToken(token));
  if (!record) return problem(400, INVALID);

  const user = await getUserById(record.user_id);
  if (!user || user.id !== session.userId) return problem(400, INVALID);

  // A change link moves the account to the address it was mailed to.
  if (record.change) {
    if (!(await applyEmailChange(user, record.email, true))) {
      return problem(409, "That address now belongs to another account. Your email was not changed.");
    }
    return NextResponse.json({ ok: true, changed: true, email: record.email });
  }

  // Any other link confirms the address it was sent to, nothing else.
  if (user.email !== record.email) return problem(400, INVALID);
  await markEmailVerified(user.id, record.email);
  return NextResponse.json({ ok: true });
}
