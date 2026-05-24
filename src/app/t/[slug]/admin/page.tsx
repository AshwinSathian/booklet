"use client";

import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

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
  const { user, isLoaded } = useUser();
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
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok) {
        setInviteResult({ ok: true, message: `Invite sent to ${inviteEmail.trim()}.` });
        setInviteEmail("");
      } else {
        setInviteResult({ ok: false, message: data.error ?? "Failed to send invite." });
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
      window.location.href = "/my-pages";
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [team]);

  if (loading || !isLoaded) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 13 13" fill="none" className="animate-spin text-text-muted" aria-hidden>
          <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-sm text-text-muted">Team not found.</p>
      </div>
    );
  }

  if (team.user_id !== user?.id) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-sm text-text-muted">Only the team owner can access settings.</p>
      </div>
    );
  }

  // Build the display list: owner at top (not in collection_members), then members
  const memberRows = members.filter((m) => m.user_id !== team.user_id);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="border-b border-border-subtle bg-bg/85 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto w-full max-w-2xl px-4 h-12 flex items-center justify-between gap-4">
          <Link href="/">
            <AppLogo onlyIcon={false} />
          </Link>
          <Link href={`/t/${slug}`} className="text-xs text-text-muted hover:text-text-primary transition">
            ← Back to team
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-xl font-semibold mb-8">Team settings</h1>

        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

        {/* Rename */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3">Team name</h2>
          <div className="flex items-center gap-2">
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={80}
              onKeyDown={(e) => { if (e.key === "Enter") void handleRename(); }}
              className="min-w-0 flex-1 rounded-lg border border-outline bg-bg px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
            />
            <Button
              variant={saveSuccess ? "ghost" : "primary"}
              size="md"
              onClick={() => void handleRename()}
              disabled={saving || teamName === team.name}
              className={saveSuccess ? "text-accent" : ""}
            >
              {saveSuccess ? "Saved" : saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </section>

        {/* Members */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3">Members</h2>
          <div className="flex flex-col gap-2 mb-4">
            {/* Owner row — always first */}
            <div className="flex items-center justify-between rounded-xl border border-outline bg-bg-elevated px-4 py-2.5 gap-3">
              <div className="min-w-0">
                <p className="text-sm text-text-primary truncate">
                  {user?.primaryEmailAddress?.emailAddress ?? user?.id}
                </p>
                <p className="text-xs text-text-muted">Owner</p>
              </div>
            </div>
            {memberRows.map((m) => (
              <div key={m.id} className="group flex items-center justify-between rounded-xl border border-outline bg-bg-elevated px-4 py-2.5 gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{m.email ?? m.user_id}</p>
                  <p className="text-xs text-text-muted capitalize">{m.role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => void handleRemoveMember(m.user_id)}
                  disabled={removingId === m.user_id}
                  className="shrink-0 text-xs sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-400 hover:bg-red-400/8"
                >
                  {removingId === m.user_id ? "…" : "Remove"}
                </Button>
              </div>
            ))}
            {memberRows.length === 0 && (
              <p className="text-xs text-text-muted">No other members yet. Invite someone below.</p>
            )}
          </div>

          {/* Invite form */}
          <div className="flex items-center gap-2">
            <input
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-outline bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
              onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); }}
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => void handleInvite()}
              disabled={inviting || !inviteEmail.trim()}
              className="shrink-0"
            >
              {inviting ? "Sending…" : "Send invite"}
            </Button>
          </div>
          {inviteResult && (
            <p className={`mt-1.5 text-xs ${inviteResult.ok ? "text-text-secondary" : "text-red-400"}`}>
              {inviteResult.message}
            </p>
          )}
        </section>

        {/* Danger zone */}
        <section className="rounded-xl border border-red-500/20 p-5">
          <h2 className="text-sm font-semibold text-red-400 mb-1">Danger zone</h2>
          <p className="text-xs text-text-muted mb-4">
            Deleting a team is permanent. Pages are kept but removed from this team.
          </p>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <Button variant="danger" size="md" onClick={() => void handleDelete()} disabled={deleting}>
                {deleting ? "Deleting…" : "Yes, delete team"}
              </Button>
              <Button variant="ghost" size="md" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="md"
              onClick={() => setConfirmDelete(true)}
              className="text-red-400 hover:bg-red-400/8 hover:text-red-300"
            >
              Delete team
            </Button>
          )}
        </section>
      </main>
    </div>
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
