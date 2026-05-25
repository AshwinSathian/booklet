import { getCollectionRecord } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const INVITE_TTL_SECONDS = 72 * 60 * 60; // 72 hours

function getJwtSecret(): Uint8Array {
  const secret = process.env.INVITE_JWT_SECRET ?? process.env.CLERK_SECRET_KEY ?? "readable-invite-dev-secret";
  return new TextEncoder().encode(secret);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const team = await getCollectionRecord(id);
  if (!team || !team.is_team_space) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (team.user_id !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 422 });
  }

  const token = await new SignJWT({ teamId: id, invitedEmail: email, invitedBy: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${INVITE_TTL_SECONDS}s`)
    .setIssuedAt()
    .sign(getJwtSecret());

  const origin = new URL(req.url).origin;
  const inviteUrl = `${origin}/t/join?token=${token}`;

  return NextResponse.json({ ok: true, inviteUrl }, { status: 201 });
}
