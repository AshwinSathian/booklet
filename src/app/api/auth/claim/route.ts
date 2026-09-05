import { NextResponse } from "next/server";
import { getUserById, setUserPassword } from "@/lib/db/auth";
import { createSession } from "@/lib/auth/session";
import { hashUserPassword } from "@/lib/auth/password";
import { verifyClaimToken } from "@/lib/auth/claim-token";
import { ClaimSchema } from "@/lib/auth/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { isSameOriginRequest } from "@/lib/auth/origin-check";

export const runtime = "nodejs";

// Sets the initial password for a user migrated off Clerk (see
// scripts/migrate-clerk-users.mjs). Single-use: once password_hash is set,
// the same token can never be replayed to overwrite it — password resets
// are explicitly out of scope for this flow (see PLAN-backend-auth-migration.md).
export async function POST(req: Request) {
  // This mints a session (Set-Cookie) on success, same as login/signup — a
  // cross-site POST with the attacker's own claim token would otherwise log
  // the victim into the attacker's account (login CSRF).
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const ip = getClientIp(req.headers);
  const rl = await checkRateLimit(`claim__ip__${ip}`, 10);
  if (rl) return rl;

  const parsed = ClaimSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { token, password } = parsed.data;

  let userId: string;
  try {
    ({ userId } = await verifyClaimToken(token));
  } catch {
    return NextResponse.json({ error: "This claim link is invalid or has expired" }, { status: 400 });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "This claim link is invalid or has expired" }, { status: 400 });
  }
  if (user.password_hash) {
    return NextResponse.json({ error: "This account has already been claimed" }, { status: 409 });
  }

  const passwordHash = await hashUserPassword(password);
  await setUserPassword(user.id, passwordHash);
  await createSession(user.id);

  return NextResponse.json({ ok: true, email: user.email }, { status: 200 });
}
