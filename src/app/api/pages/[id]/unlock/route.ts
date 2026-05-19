import { getPageRecord } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Cookie name pattern: readable_unlock_<pageId>
// Value: 1 (just presence matters; the hash check happened server-side)
// Expires in 8 hours.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let password: string | undefined;
  try {
    const body = (await req.json()) as { password?: string };
    password = body.password;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const page = await getPageRecord(id).catch(() => null);
  if (!page || !page.password_hash) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ok = await verifyPassword(password, page.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const cookieName = `readable_unlock_${id}`;
  const maxAge = 8 * 60 * 60; // 8 hours

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: `/p/${id}`,
  });
  return res;
}
