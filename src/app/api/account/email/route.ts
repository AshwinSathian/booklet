import { NextResponse } from "next/server";
import { getUserByEmail, getUserById } from "@/lib/db/auth";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { verifyUserPassword } from "@/lib/auth/password";
import { EmailSchema } from "@/lib/auth/schemas";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSiteOrigin } from "@/lib/site-url";
import { problem } from "@/server/errors";
import { applyEmailChange, emailVerificationRequired, sendEmailChangeLink } from "@/server/verification";

export const runtime = "nodejs";

/**
 * Starts a change of the signed-in account's email address.
 *
 * Where mail is configured the address does not change here: a link goes
 * to the new address, and the change happens when it is confirmed from
 * this account's session (POST /api/auth/verify-email). So the account
 * only ever moves to an address its holder can read. The answer is the same
 * whether or not the new address belongs to another account, so this
 * cannot be used to find out who has one.
 *
 * Without mail, nobody can confirm anything, and the address changes now.
 *
 * An account with a password must give it: a borrowed, signed-in browser is
 * not enough to take the account's recovery address.
 */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req) || !req.headers.get("origin")) {
    return problem(403, "Invalid request origin");
  }
  const session = await getSession();
  if (!session) return problem(401, "Not signed in");
  const limited = await checkRateLimit(`change_email__${session.userId}`, 5);
  if (limited) return limited;

  const user = await getUserById(session.userId);
  if (!user) return problem(401, "Not signed in");

  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const next = EmailSchema.safeParse(body?.email);
  if (!next.success) return problem(400, "Enter a valid email address.");
  if (next.data === user.email) return problem(400, "That is already this account's address.");

  if (user.password_hash) {
    const password = body?.password;
    if (typeof password !== "string" || password.length > 256 || !(await verifyUserPassword(password, user.password_hash))) {
      return problem(403, "That password is not correct.");
    }
  }

  const taken = (await getUserByEmail(next.data)) !== null;

  if (!emailVerificationRequired()) {
    if (taken) return problem(409, "Another account uses that address.");
    const changed = await applyEmailChange(user, next.data);
    if (!changed) return problem(409, "Another account uses that address.");
    return NextResponse.json({ ok: true, changed: true });
  }

  // Nothing is sent for an address that is taken, and nothing says so.
  if (!taken) await sendEmailChangeLink(user, next.data, getSiteOrigin(req));
  return NextResponse.json({ ok: true, changed: false });
}
