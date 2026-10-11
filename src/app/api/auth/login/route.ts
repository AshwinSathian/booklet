import { sendVerification } from "@/server/verification";
import { getSiteOrigin } from "@/lib/site-url";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db/auth";
import { createSession } from "@/lib/auth/session";
import { verifyUserPassword } from "@/lib/auth/password";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { LoginSchema } from "@/lib/auth/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

// Generic message on every failure path below — never reveal whether the
// email exists, whether the account has a password set, or whether the
// password itself was wrong (user enumeration).
const INVALID_CREDENTIALS = "Invalid email or password";

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return problem(403, "Invalid request origin");
  }

  const ip = getClientIp(req.headers);
  const ipLimit = await checkRateLimit(`login__ip__${ip}`, 10);
  if (ipLimit) return ipLimit;

  const parsed = LoginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return problem(400, INVALID_CREDENTIALS);
  }
  const { email, password } = parsed.data;

  const emailLimit = await checkRateLimit(`login__email__${email}`, 5);
  if (emailLimit) return emailLimit;

  const user = await getUserByEmail(email);
  if (!user || !user.password_hash) {
    return problem(401, INVALID_CREDENTIALS);
  }

  const valid = await verifyUserPassword(password, user.password_hash);
  if (!valid) {
    return problem(401, INVALID_CREDENTIALS);
  }

  await createSession(user.id);
  // Accounts that predate verification get their link the first time they
  // sign in after it shipped.
  await sendVerification(user, getSiteOrigin(req), { onlyIfNoneLive: true }).catch((err) =>
    logError("login", "Could not send verification email", err),
  );

  return NextResponse.json({ ok: true, email: user.email }, { status: 200 });
}
