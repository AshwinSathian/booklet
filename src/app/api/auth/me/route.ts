import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/auth";

export const runtime = "nodejs";

// Lightweight "who am I" check for client components (mirrors Clerk's
// client-side useUser() sync) — the session cookie itself is httpOnly and
// deliberately unreadable from client JS, so this is the only way client
// components learn sign-in state. Never returns password_hash.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ userId: null, email: null });
  }

  const user = await getUserById(session.userId);
  return NextResponse.json({ userId: session.userId, email: user?.email ?? null });
}
