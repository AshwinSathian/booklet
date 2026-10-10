import { addCollectionMember, claimPendingMember, getCollectionMember, getCollectionRecord } from "@/lib/db";
import { getUserById } from "@/lib/db/auth";
import { createId } from "@/lib/id";
import { verifyInviteToken } from "@/lib/invite-token";
import { isVerified } from "@/server/verification";
import { logError } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TeamJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <ErrorPage message="Invalid invite link." />;
  }

  let payload: Awaited<ReturnType<typeof verifyInviteToken>>;
  try {
    payload = await verifyInviteToken(token);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("INVITE_JWT_SECRET")) {
      logError("t/join", "Failed to verify invite token", err);
      return <ErrorPage message="Joining a team isn't available right now. Please contact the administrator." />;
    }
    return <ErrorPage message="This invite link has expired or is invalid." />;
  }

  const session = await getSession();
  if (!session) {
    redirect(`/sign-in?redirect_url=/t/join?token=${encodeURIComponent(token)}`);
  }
  const { userId } = session;

  const user = await getUserById(userId);
  const userEmail = user?.email?.toLowerCase() ?? null;

  // Membership opens the space's team-only pages, so the invite is for one
  // address and nobody else: an account with a different address, or none,
  // does not get in.
  if (typeof payload.invitedEmail !== "string" || userEmail !== payload.invitedEmail.toLowerCase()) {
    return (
      <ErrorPage message={`This invite was sent to ${payload.invitedEmail}. Please sign in with that account.`} />
    );
  }
  // Anyone can sign up with the invited address. Until it is confirmed,
  // holding the account is not proof of being the person invited.
  if (!isVerified(user)) {
    return <ErrorPage message="Confirm your email address first: open Account settings and choose “Email me the link”. Then open this invite again." />;
  }

  const team = await getCollectionRecord(payload.teamId);
  if (!team?.is_team_space) {
    return <ErrorPage message="This team no longer exists." />;
  }
  // Removing a member cancels the invites sent to them before it, or they
  // could walk back in with the link they joined by.
  const issuedAt = (payload.iat ?? 0) * 1000;
  if (team.invite_revocations?.some((r) => r.email === userEmail && issuedAt < Date.parse(r.at))) {
    return <ErrorPage message="This invite link has expired or is invalid." />;
  }

  // Someone already in the space keeps the role they have: an invite always
  // carries "editor", and a link opened again must not undo a change to viewer.
  if (team.user_id === userId || (await getCollectionMember(payload.teamId, userId))) {
    redirect(`/t/${team.slug ?? payload.teamId}`);
  }

  // If the owner already listed this address with a role, before it had a
  // confirmed account, that role stands. Otherwise an invite makes an editor.
  const role = (await claimPendingMember(payload.teamId, payload.invitedEmail.toLowerCase())) ?? "editor";
  await addCollectionMember(createId(10), payload.teamId, userId, userEmail, role, payload.invitedBy);

  redirect(`/t/${team.slug ?? payload.teamId}`);
}

function ErrorPage({ message }: { message: string }) {
  return (
    <AuthLayout>
      <div className="flex h-12 w-12 items-center justify-center rounded-card bg-fill-2 text-text-muted">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm text-text-secondary text-center max-w-sm">{message}</p>
    </AuthLayout>
  );
}
