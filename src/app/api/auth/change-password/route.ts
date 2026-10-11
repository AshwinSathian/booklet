import { NextResponse } from "next/server";
import { getUserById, setUserPassword } from "@/lib/db/auth";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { hashUserPassword, verifyUserPassword } from "@/lib/auth/password";
import { PasswordSchema } from "@/lib/auth/schemas";
import { createSession, destroyAllSessions, getSession } from "@/lib/auth/session";
import { revokeAllForUser } from "@/lib/oauth/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

/**
 * Changes the signed-in user's password, or sets a first one on an account
 * that signs in through a provider or passkey. Like a password reset, it
 * signs out every other browser and disconnects every app; this browser
 * gets a fresh session.
 */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req) || !req.headers.get("origin")) {
    return problem(403, "Invalid request origin");
  }
  const session = await getSession();
  if (!session) return problem(401, "Not signed in");
  const limited = await checkRateLimit(`change_password__${session.userId}`, 5);
  if (limited) return limited;

  const user = await getUserById(session.userId);
  if (!user) return problem(401, "Not signed in");

  const body = (await req.json().catch(() => null)) as { current_password?: unknown; new_password?: unknown } | null;
  const next = PasswordSchema.safeParse(body?.new_password);
  if (!next.success) return problem(400, "The new password must be at least 8 characters.");

  if (user.password_hash) {
    const current = body?.current_password;
    if (typeof current !== "string" || current.length > 256 || !(await verifyUserPassword(current, user.password_hash))) {
      return problem(403, "Your current password is not correct.");
    }
  }

  await setUserPassword(user.id, await hashUserPassword(next.data));
  await destroyAllSessions(user.id);
  await revokeAllForUser(user.id);
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
