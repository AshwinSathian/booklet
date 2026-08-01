import { NextResponse } from "next/server";
import { findPasswordResetTokenByHash, deletePasswordResetToken, setUserPassword } from "@/lib/db/auth";
import { hashPasswordResetToken } from "@/lib/auth/password-reset-token";
import { hashUserPassword } from "@/lib/auth/password";
import { destroyAllSessions } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { ResetPasswordSchema } from "@/lib/auth/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";

const INVALID_OR_EXPIRED = { error: "This reset link is invalid or has expired." } as const;

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const ip = getClientIp(req.headers);
  const ipLimit = await checkRateLimit(`reset-password__ip__${ip}`, 10);
  if (ipLimit) return ipLimit;

  const parsed = ResetPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(INVALID_OR_EXPIRED, { status: 400 });
  }
  const { token, password } = parsed.data;

  const tokenHash = await hashPasswordResetToken(token);
  const resetToken = await findPasswordResetTokenByHash(tokenHash);
  if (!resetToken || resetToken.expires_at.getTime() <= Date.now()) {
    return NextResponse.json(INVALID_OR_EXPIRED, { status: 400 });
  }

  const passwordHash = await hashUserPassword(password);
  await setUserPassword(resetToken.user_id, passwordHash);
  await deletePasswordResetToken(tokenHash);
  // A password reset is a strong signal of compromise recovery — kill every
  // existing session so a stolen cookie doesn't outlive the password it was
  // issued under.
  await destroyAllSessions(resetToken.user_id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
