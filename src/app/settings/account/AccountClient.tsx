"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { Button, buttonClass } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { ROUTES } from "@/lib/constants";
import { SettingsRow, SettingsSection, StatusChip } from "../SettingsShell";
import { send } from "../request";

type Props = {
  email: string;
  emailState: "confirmed" | "unconfirmed" | null;
  hasPassword: boolean;
  memberSince: string;
  signInSummary: string;
};

const LABEL = "flex flex-col gap-1.5 text-sm font-medium text-text-primary";

export function AccountClient({ email, emailState, hasPassword, memberSince, signInSummary }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<"email" | "delete" | null>(null);
  const [sending, setSending] = useState(false);

  async function sendLink() {
    setSending(true);
    const error = await send("/api/auth/verify-email/send", "POST");
    setSending(false);
    if (error) toast.error("The link was not sent", error);
    else toast.success("Sent. Check your inbox.");
  }

  return (
    <>
      {emailState === "unconfirmed" && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border border-border-strong bg-fill-1 px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-sm font-semibold">Confirm your email address</p>
            <p className="mt-0.5 text-sm leading-relaxed text-text-secondary">
              You can write drafts now. Publishing starts once you open the link we email to {email}.
            </p>
          </div>
          <Button variant="primary" size="md" disabled={sending} onClick={() => void sendLink()}>
            Email me the link
          </Button>
        </div>
      )}

      <SettingsSection title="Profile">
        <SettingsRow
          label="Email address"
          detail={
            <>
              <span className="break-all">{email}</span>
              {emailState === "confirmed" && <StatusChip>Confirmed</StatusChip>}
              {emailState === "unconfirmed" && <StatusChip tone="warn">Not confirmed</StatusChip>}
            </>
          }
          action={
            <Button variant="secondary" size="md" onClick={() => setDialog("email")}>
              Change email
            </Button>
          }
        />
        <SettingsRow
          label="Signing in"
          detail={signInSummary}
          action={
            <Link href={ROUTES.security} className={buttonClass("secondary", "md")}>
              Manage
            </Link>
          }
        />
        <SettingsRow label="Member since" detail={memberSince} />
      </SettingsSection>

      <SettingsSection title="Your data">
        <SettingsRow
          label="Download all pages"
          detail="A ZIP file with one Markdown file per page, each with its title, link and visibility as frontmatter."
          action={
            <a href="/api/account/export" className={buttonClass("secondary", "md")}>
              Download ZIP
            </a>
          }
        />
      </SettingsSection>

      <SettingsSection title="Danger zone" tone="danger">
        <SettingsRow
          label="Delete this account and its pages"
          detail="Every page you published, their version history, your drafts, API keys and webhooks are deleted. Links to your pages stop working. This cannot be undone."
          action={
            <Button variant="danger" size="md" onClick={() => setDialog("delete")}>
              Delete account
            </Button>
          }
        />
      </SettingsSection>

      <Dialog
        open={dialog === "email"}
        onClose={() => setDialog(null)}
        title="Change email address"
        description={`This account's address is ${email}. Sign-in, password resets and team invites all go by it.`}
      >
        <ChangeEmailForm
          hasPassword={hasPassword}
          unconfirmed={emailState === "unconfirmed"}
          onClose={() => setDialog(null)}
          onChanged={() => router.refresh()}
        />
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title="Delete account"
        description="This deletes your account, every page you published, their version history, your drafts, API keys and webhooks. It cannot be undone."
      >
        <DeleteAccountForm email={email} hasPassword={hasPassword} onClose={() => setDialog(null)} />
      </Dialog>
    </>
  );
}

function ChangeEmailForm({ hasPassword, unconfirmed, onClose, onChanged }: { hasPassword: boolean; unconfirmed: boolean; onClose: () => void; onChanged: () => void }) {
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const next = address.trim();
    try {
      const res = await fetch("/api/account/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: next, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { changed?: boolean; detail?: string };
      if (!res.ok) {
        setError(data.detail ?? "Something went wrong. Try again.");
        return;
      }
      // Where mail is set up a link goes out and nothing changes yet. Where it
      // is not, the address has already changed: the answer says which.
      setDone(
        data.changed === true
          ? `This account's email address is now ${next}.${unconfirmed ? " Use “Email me the link” to confirm it." : ""}`
          : // The same words whether or not a link went out: see the route.
            `If ${next} can be used, we sent it a link. Open it while signed in here and this account moves to that address.`,
      );
      onChanged();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <p role="status" className="text-sm leading-relaxed text-text-primary">{done}</p>
        <div className="flex justify-end">
          <Button variant="primary" size="md" onClick={onClose}>
            Done
          </Button>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <label className={LABEL}>
        New email address
        <input type="email" autoFocus autoComplete="email" required maxLength={254} value={address} onChange={(e) => setAddress(e.target.value)} className="field font-normal" />
      </label>
      {hasPassword && (
        <label className={LABEL}>
          Your password
          <input type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={(e) => setPassword(e.target.value)} className="field font-normal" />
        </label>
      )}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={busy}>
          {busy ? "Changing…" : "Change email"}
        </Button>
      </div>
    </form>
  );
}

function DeleteAccountForm({ email, hasPassword, onClose }: { email: string; hasPassword: boolean; onClose: () => void }) {
  const router = useRouter();
  const { refetch } = useSession();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const failed = await send("/api/account/delete", "POST", hasPassword ? { password: confirm } : { confirm_email: confirm });
    if (failed) {
      setError(failed);
      setBusy(false);
      return;
    }
    await refetch();
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      <label className={LABEL}>
        {hasPassword ? "Your password" : `Type ${email} to confirm`}
        <input
          type={hasPassword ? "password" : "email"}
          autoFocus
          autoComplete={hasPassword ? "current-password" : "off"}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="field font-normal"
        />
      </label>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="danger" size="md" disabled={busy}>
          {busy ? "Deleting…" : "Delete my account and pages"}
        </Button>
      </div>
    </form>
  );
}
