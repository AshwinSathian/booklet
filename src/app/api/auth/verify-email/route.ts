import { NextResponse } from "next/server";
import { consumeEmailVerificationToken, getUserById, markEmailVerified } from "@/lib/db/auth";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { hashVerificationToken } from "@/server/verification";

export const runtime = "nodejs";

const INVALID = { error: "This link is invalid or has expired. Send a new one from Account settings." } as const;

/**
 * Confirms an email address. A POST from the button on /verify-email, not
 * the link itself: mail scanners open links, and a GET that verified would
 * let one confirm an address nobody at that address had seen. No session is
 * needed, so the link works in any browser.
 */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const rl = await checkRateLimit(`verify-email__ip__${getClientIp(req.headers)}`, 10);
  if (rl) return rl;

  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = body?.token;
  if (typeof token !== "string" || !token || token.length > 128) {
    return NextResponse.json(INVALID, { status: 400 });
  }

  const record = await consumeEmailVerificationToken(await hashVerificationToken(token));
  if (!record) return NextResponse.json(INVALID, { status: 400 });

  // The link confirms the address it was sent to, nothing else.
  const user = await getUserById(record.user_id);
  if (!user || user.email !== record.email) return NextResponse.json(INVALID, { status: 400 });

  await markEmailVerified(user.id);
  return NextResponse.json({ ok: true });
}
