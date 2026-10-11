"use client";

import { AppPage, AppPageTitle } from "@/components/app/AppPage";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";

type Member = {
  id: string;
  user_id: string;
  email: string | null;
  role: string;
  created_at: string;
};

type TeamData = {
  id: string;
  name: string;
  slug: string | null;
  user_id: string;
};

function AdminPageInner({ slug }: { slug: string }) {
  const { userId, email, isLoaded } = useSession();
  const router = useRouter();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const load = async () => {
      try {
        const res = await fetch("/api/teams");
        if (!res.ok) { setLoading(false); return; }
        const data = (await res.json()) as { teams: (TeamData & { is_team_space: boolean })[] };
        const found = data.teams.find((t) => t.slug === slug);
        if (!found) { setLoading(false); return; }
        setTeam(found);
        setTeamName(found.name);

        const mRes = await fetch(`/api/teams/${found.id}/members`);
        if (mRes.ok) {
          const mData = (await mRes.json()) as { members: Member[] };
          setMembers(mData.members);
        }
      } catch {
        setError("Failed to load team data.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [slug, isLoaded]);

  const handleRename = useCallback(async () => {
    if (!team || teamName === team.name) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: teamName }),
      });
      if (res.ok) {
        setTeam((t) => t ? { ...t, name: teamName } : t);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [team, teamName]);

  const handleInvite = useCallback(async () => {
    if (!team || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch(`/api/teams/${team.id}/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; detail?: string };
      if (res.ok) {
        setInviteResult({ ok: true, message: `Invite sent to ${inviteEmail.trim()}.` });
        setInviteEmail("");
      } else {
        setInviteResult({ ok: false, message: data.detail ?? "Failed to send invite." });
      }
    } finally {
      setInviting(false);
    }
  }, [team, inviteEmail]);

  const handleRemoveMember = useCallback(async (memberId: string) => {
    if (!team) return;
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/teams/${team.id}/members`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: memberId }),
      });
      if (res.ok || res.status === 204) {
        setMembers((prev) => prev.filter((m) => m.user_id !== memberId));
      }
    } finally {
      setRemovingId(null);
    }
  }, [team]);

  const handleDelete = useCallback(async () => {
    if (!team) return;
    setDeleting(true);
    try {
      await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      router.push("/my-pages");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [team, router]);

  if (loading || !isLoaded) {
    return (
      // Inside AppPage, so the header is there from the first paint.
      <AppPage>
        <div className="flex justify-center py-24" role="status" aria-label="Loading team settings">
          <svg width="24" height="24" viewBox="0 0 13 13" fill="none" className="animate-spin text-text-muted" aria-hidden>
            <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </AppPage>
    );
  }

  if (!team) {
    return (
      <AppPage>
        <AppPageTitle
          back={{ href: "/t", label: "Spaces" }}
          eyebrow="Space"
          title="Team not found"
          lede="There is no team space at this address, or you are not a member of it."
        />
        <Button variant="secondary" size="lg" href="/t">All spaces</Button>
      </AppPage>
    );
  }

  if (team.user_id !== userId) {
    return (
      <AppPage>
        <AppPageTitle
          back={{ href: `/t/${slug}`, label: team.name }}
          eyebrow="Space"
          title="Only the owner can change this team"
          lede="You are a member of this space. Its name, members and deletion are the owner's to manage."
        />
        <Button variant="secondary" size="lg" href={`/t/${slug}`}>Back to the space</Button>
      </AppPage>
    );
  }

  // Build the display list: owner at top (not in collection_members), then members
  const memberRows = members.filter((m) => m.user_id !== team.user_id);

  return (
    <AppPage>
        <AppPageTitle back={{ href: `/t/${slug}`, label: team.name }} eyebrow="Space" title="Team settings" />

        {error && <p className="text-sm text-danger mb-4">{error}</p>}

        {/* Rename */}
        <section className="mb-10">
          <h2 className="mb-3 text-[0.9375rem] font-semibold">Team name</h2>
          <div className="flex items-center gap-2">
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={80}
              aria-label="Team space name"
              onKeyDown={(e) => { if (e.key === "Enter") void handleRename(); }}
              className="min-w-0 flex-1 field"
            />
            <Button
              variant={saveSuccess ? "secondary" : "primary"}
              size="lg"
              onClick={() => void handleRename()}
              disabled={saving || teamName === team.name}
            >
              {saveSuccess ? "Saved" : saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </section>

        {/* Members */}
        <section className="mb-10">
          <h2 className="mb-3 text-[0.9375rem] font-semibold">Members</h2>
          <div className="flex flex-col gap-2 mb-4">
            {/* Owner row — always first */}
            <div className="flex items-center justify-between rounded-xl border border-border-default bg-bg-elevated px-4 py-2.5 gap-3">
              <div className="min-w-0">
                <p className="text-sm text-text-primary truncate">
                  {email ?? userId}
                </p>
                <p className="text-xs text-text-muted">Owner</p>
              </div>
            </div>
            {memberRows.map((m) => (
              <div key={m.id} className="group flex items-center justify-between rounded-xl border border-border-default bg-bg-elevated px-4 py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{m.email ?? m.user_id}</p>
                  <p className="text-xs text-text-muted capitalize">{m.role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => void handleRemoveMember(m.user_id)}
                  disabled={removingId === m.user_id}
                  className="shrink-0 text-xs sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger hover:bg-danger/8"
                >
                  {removingId === m.user_id ? "…" : "Remove"}
                </Button>
              </div>
            ))}
            {memberRows.length === 0 && (
              <p className="text-sm text-text-secondary">No other members yet. Invite someone below.</p>
            )}
          </div>

          {/* Invite form */}
          <div className="flex items-center gap-2">
            <input
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="min-w-0 flex-1 field"
              onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); }}
            />
            <Button
              variant="primary"
              size="lg"
              onClick={() => void handleInvite()}
              disabled={inviting || !inviteEmail.trim()}
              className="shrink-0"
            >
              {inviting ? "Sending…" : "Send invite"}
            </Button>
          </div>
          {inviteResult && (
            <p className={`mt-1.5 text-xs ${inviteResult.ok ? "text-text-secondary" : "text-danger"}`}>
              {inviteResult.message}
            </p>
          )}
        </section>

        {/* Danger zone */}
        <section className="border-t border-border-default pt-8">
          <h2 className="mb-1 text-[0.9375rem] font-semibold">Delete this team</h2>
          <p className="mb-4 text-sm text-text-secondary">
            Deleting a team is permanent. Pages are kept but removed from this team.
          </p>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button variant="danger" size="lg" onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? "Deleting…" : "Yes, delete team"}
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="danger" size="lg" onClick={() => setConfirmDelete(true)}>
              Delete team
            </Button>
          )}
        </section>
    </AppPage>
  );
}

export default function TeamAdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  return <AdminPageInner slug={slug} />;
}
