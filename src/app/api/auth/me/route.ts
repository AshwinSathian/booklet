import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/auth";
import { isVerified } from "@/server/verification";

export const runtime = "nodejs";

// Lightweight "who am I" check for client components — the session cookie itself is httpOnly and
// deliberately unreadable from client JS, so this is the only way client
// components learn sign-in state. Never returns password_hash.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ userId: null, email: null, emailVerified: false });
  }

  const user = await getUserById(session.userId);
  // `emailVerified` is true wherever verification is not enforced.
  return NextResponse.json({ userId: session.userId, email: user?.email ?? null, emailVerified: isVerified(user) });
}
