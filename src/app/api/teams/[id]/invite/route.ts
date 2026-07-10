import { getCollectionRecord } from "@/lib/db";
import { signInviteToken } from "@/lib/invite-token";
import { logError } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

  let token: string;
  try {
    token = await signInviteToken({ teamId: id, invitedEmail: email, invitedBy: userId });
  } catch (err) {
    logError("teams/invite", "Failed to sign invite token", err);
    return NextResponse.json({ error: "Invite creation is misconfigured. Contact the administrator." }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const inviteUrl = `${origin}/t/join?token=${token}`;

  return NextResponse.json({ ok: true, inviteUrl }, { status: 201 });
}
