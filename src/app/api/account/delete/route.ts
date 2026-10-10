import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserById } from "@/lib/db/auth";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { verifyUserPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { deleteAccount } from "@/server/account";

export const runtime = "nodejs";

/**
 * Deletes the signed-in account and its pages. Asks for the password where
 * the account has one, so a borrowed, unlocked browser is not enough. An
 * account with no password (provider or passkey sign-in) confirms by typing
 * its email address.
 */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req) || !req.headers.get("origin")) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const limited = await checkRateLimit(`delete_account__${session.userId}`, 5);
  if (limited) return limited;

  const user = await getUserById(session.userId);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { password?: unknown; confirm_email?: unknown } | null;
  const confirmed = user.password_hash
    ? typeof body?.password === "string" && body.password.length <= 256 && (await verifyUserPassword(body.password, user.password_hash))
    : typeof body?.confirm_email === "string" && body.confirm_email.trim().toLowerCase() === user.email;
  if (!confirmed) {
    return NextResponse.json(
      { error: user.password_hash ? "That password is not correct." : "Type your account's email address to confirm." },
      { status: 403 },
    );
  }

  await deleteAccount(user.id);
  (await cookies()).delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
