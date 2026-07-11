import { signInviteToken } from "@/lib/invite-token";
import { logError } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
import { getOwnedTeamSpace } from "@/server/collections";
import { toErrorResponse } from "@/server/errors";
import { getSiteOrigin } from "@/lib/site-url";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await getOwnedTeamSpace(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }

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

  const inviteUrl = `${getSiteOrigin(req)}/t/join?token=${token}`;

  return NextResponse.json({ ok: true, inviteUrl }, { status: 201 });
}
