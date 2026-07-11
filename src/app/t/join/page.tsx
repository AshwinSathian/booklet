import { addCollectionMember, getCollectionRecord } from "@/lib/db";
import { getUserById } from "@/lib/db/auth";
import { createId } from "@/lib/id";
import { verifyInviteToken } from "@/lib/invite-token";
import { logError } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
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

  let payload: { teamId: string; invitedEmail: string; invitedBy: string };
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

  if (userEmail && payload.invitedEmail && userEmail !== payload.invitedEmail.toLowerCase()) {
    return (
      <ErrorPage message={`This invite was sent to ${payload.invitedEmail}. Please sign in with that account.`} />
    );
  }

  const team = await getCollectionRecord(payload.teamId);
  if (!team) {
    return <ErrorPage message="This team no longer exists." />;
  }

  await addCollectionMember(
    createId(10),
    payload.teamId,
    userId,
    userEmail,
    "editor",
    payload.invitedBy,
  );

  redirect(`/t/${team.slug ?? payload.teamId}`);
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-fill-2 text-text-muted mx-auto">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-sm text-text-secondary">{message}</p>
      </div>
    </div>
  );
}
