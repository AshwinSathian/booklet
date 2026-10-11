import { TURNSTILE_FAILED, verifyTurnstile } from "@/lib/turnstile";
import { sendVerification } from "@/server/verification";
import { getSiteOrigin } from "@/lib/site-url";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";
import { createUser, getUserByEmail } from "@/lib/db/auth";
import { createId } from "@/lib/id";
import { createSession } from "@/lib/auth/session";
import { hashUserPassword } from "@/lib/auth/password";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { SignupSchema } from "@/lib/auth/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return problem(403, "Invalid request origin");
  }

  const ip = getClientIp(req.headers);
  const rl = await checkRateLimit(`signup__ip__${ip}`, 5);
  if (rl) return rl;

  const body = (await req.json().catch(() => null)) as { turnstile_token?: unknown } | null;
  if (!(await verifyTurnstile(req, body?.turnstile_token))) {
    return problem(403, TURNSTILE_FAILED);
  }

  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, "Invalid email or password");
  }
  const { email, password } = parsed.data;

  if (await getUserByEmail(email)) {
    return problem(409, "An account with this email already exists");
  }

  const passwordHash = await hashUserPassword(password);

  // The getUserByEmail check above is a friendly pre-check, not the
  // authoritative guard — the unique index on users.email is (see
  // src/lib/db/index-specs.mjs). Two concurrent signups for the same email
  // can both pass that check before either inserts, so the second insertOne
  // here throws E11000; catch it and report the same 409 rather than letting
  // it surface as an unhandled 500.
  let user;
  try {
    user = await createUser(createId(20), email, passwordHash);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("E11000")) {
      return problem(409, "An account with this email already exists");
    }
    throw err;
  }
  await createSession(user.id);
  await sendVerification(user, getSiteOrigin(req)).catch((err) => logError("signup", "Could not send verification email", err));

  return NextResponse.json({ ok: true, email: user.email }, { status: 201 });
}
