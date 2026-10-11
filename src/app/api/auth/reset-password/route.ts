import { NextResponse } from "next/server";
import { findPasswordResetTokenByHash, deletePasswordResetToken, markEmailVerified, setUserPassword } from "@/lib/db/auth";
import { hashPasswordResetToken } from "@/lib/auth/password-reset-token";
import { hashUserPassword } from "@/lib/auth/password";
import { destroyAllSessions } from "@/lib/auth/session";
import { revokeAllForUser } from "@/lib/oauth/server";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { ResetPasswordSchema } from "@/lib/auth/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

const INVALID_OR_EXPIRED = "This reset link is invalid or has expired.";

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return problem(403, "Invalid request origin");
  }

  const ip = getClientIp(req.headers);
  const ipLimit = await checkRateLimit(`reset-password__ip__${ip}`, 10);
  if (ipLimit) return ipLimit;

  const parsed = ResetPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return problem(400, INVALID_OR_EXPIRED);
  }
  const { token, password } = parsed.data;

  const tokenHash = await hashPasswordResetToken(token);
  const resetToken = await findPasswordResetTokenByHash(tokenHash);
  if (!resetToken || resetToken.expires_at.getTime() <= Date.now()) {
    return problem(400, INVALID_OR_EXPIRED);
  }

  const passwordHash = await hashUserPassword(password);
  await setUserPassword(resetToken.user_id, passwordHash);
  await deletePasswordResetToken(tokenHash);
  // The reset link went to the address on the token, so completing a reset
  // proves that address, and only that one: the account may have moved to
  // another since the link was sent.
  await markEmailVerified(resetToken.user_id, resetToken.email);
  // A password reset is a strong signal of compromise recovery — kill every
  // existing session so a stolen cookie doesn't outlive the password it was
  // issued under.
  await destroyAllSessions(resetToken.user_id);
  // A password reset is how someone takes an account back; apps connected
  // through OAuth lose their access along with every browser session.
  await revokeAllForUser(resetToken.user_id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
