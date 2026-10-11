import { signInviteToken } from "@/lib/invite-token";
import { logError } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
import { getOwnedTeamSpace } from "@/server/collections";
import { toErrorResponse, problem } from "@/server/errors";
import { getSiteOrigin } from "@/lib/site-url";
import { getUserById } from "@/lib/db/auth";
import { sendTeamInviteEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertVerified } from "@/server/verification";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return problem(401, "Unauthorized");

  const { id } = await params;
  let space: Awaited<ReturnType<typeof getOwnedTeamSpace>>;
  try {
    // An invite sends mail in the owner's name: only from a confirmed account, and not in bulk.
    await assertVerified(userId);
    space = await getOwnedTeamSpace(id, userId);
  } catch (e) {
    return toErrorResponse(e);
  }
  const limited = await checkRateLimit(`team_invite__${userId}`, 10);
  if (limited) return limited;

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

  // Mailed where mail is set up. The owner gets the link either way, so a
  // failed or unconfigured send costs nothing but the convenience.
  let emailed = false;
  try {
    const inviter = await getUserById(userId);
    emailed = await sendTeamInviteEmail(email, { spaceName: space.name, invitedBy: inviter?.email ?? null, joinUrl: inviteUrl });
  } catch (err) {
    logError("teams/invite", "Failed to send the invite email", err);
  }

  return NextResponse.json({ ok: true, inviteUrl, emailed }, { status: 201 });
}
