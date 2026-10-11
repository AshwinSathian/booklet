import { signInviteToken } from "@/lib/invite-token";
import { logError } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
import { getOwnedTeamSpace } from "@/server/collections";
import { toErrorResponse, problem } from "@/server/errors";
import { getSiteOrigin } from "@/lib/site-url";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return problem(401, "Unauthorized");

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
    return problem(400, "Invalid JSON");
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return problem(422, "Valid email required");
  }

  let token: string;
  try {
    token = await signInviteToken({ teamId: id, invitedEmail: email, invitedBy: userId });
  } catch (err) {
    logError("teams/invite", "Failed to sign invite token", err);
    return problem(500, "Invite creation is misconfigured. Contact the administrator.");
  }

  const inviteUrl = `${getSiteOrigin(req)}/t/join?token=${token}`;

  return NextResponse.json({ ok: true, inviteUrl }, { status: 201 });
}
