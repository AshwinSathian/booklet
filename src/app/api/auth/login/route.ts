import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db/auth";
import { createSession } from "@/lib/auth/session";
import { verifyUserPassword } from "@/lib/auth/password";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { LoginSchema } from "@/lib/auth/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";

// Generic message on every failure path below — never reveal whether the
// email exists, whether the account has a password set, or whether the
// password itself was wrong (user enumeration).
const INVALID_CREDENTIALS = { error: "Invalid email or password" } as const;

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const ip = getClientIp(req.headers);
  const ipLimit = await checkRateLimit(`login__ip__${ip}`, 10);
  if (ipLimit) return ipLimit;

  const parsed = LoginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 400 });
  }
  const { email, password } = parsed.data;

  const emailLimit = await checkRateLimit(`login__email__${email}`, 5);
  if (emailLimit) return emailLimit;

  const user = await getUserByEmail(email);
  if (!user || !user.password_hash) {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  const valid = await verifyUserPassword(password, user.password_hash);
  if (!valid) {
    return NextResponse.json(INVALID_CREDENTIALS, { status: 401 });
  }

  await createSession(user.id);

  return NextResponse.json({ ok: true, email: user.email }, { status: 200 });
}
