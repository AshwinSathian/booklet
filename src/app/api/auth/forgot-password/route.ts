import { NextResponse } from "next/server";
import { getUserByEmail, createPasswordResetToken } from "@/lib/db/auth";
import { generatePasswordResetToken, hashPasswordResetToken } from "@/lib/auth/password-reset-token";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { ForgotPasswordSchema } from "@/lib/auth/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

const RESET_TTL_MS = 30 * 60 * 1000;

// Same response on every path — do not leak whether the email has an
// account (same user-enumeration convention as /api/auth/login).
const GENERIC_RESPONSE = { ok: true, message: "If that email has an account, a reset link is on its way." };

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const ip = getClientIp(req.headers);
  const ipLimit = await checkRateLimit(`forgot-password__ip__${ip}`, 5);
  if (ipLimit) return ipLimit;

  const parsed = ForgotPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }
  const { email } = parsed.data;

  const emailLimit = await checkRateLimit(`forgot-password__email__${email}`, 3);
  if (emailLimit) return emailLimit;

  const user = await getUserByEmail(email);
  if (user && user.password_hash && user.email) {
    const raw = generatePasswordResetToken();
    const tokenHash = await hashPasswordResetToken(raw);
    await createPasswordResetToken(user.id, tokenHash, new Date(Date.now() + RESET_TTL_MS));

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://booklet.ashwinsathian.com";
    const resetUrl = `${siteUrl}/reset-password?token=${encodeURIComponent(raw)}`;

    // Fire-and-forget — do not await. This process is a long-lived
    // Node/PM2 process (not a serverless function that freezes after the
    // response is sent, per docs/OPERATIONS.md and the module-scope Mongo
    // client caching in src/lib/mongodb.ts), so the send completes in the
    // background after we respond. Awaiting here would make this branch's
    // response latency include a real network round-trip to Resend while
    // the "user doesn't exist" branch returns almost immediately — a
    // timing side-channel that leaks whether the email has an account.
    // .catch() still guards against an unhandled promise rejection.
    sendPasswordResetEmail(user.email, resetUrl).catch(() => {});
  }

  return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
}
