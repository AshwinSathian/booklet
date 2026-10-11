"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/auth/SessionProvider";
import { useHydrated } from "@/lib/ui/hydration";

const INPUT =
  "w-full rounded-lg border border-border-default bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft";
const ROW = "flex items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2.5";

const LINK_ERRORS: Record<string, string> = {
  sso_identity_taken: "That account already signs in to a different Booklet account.",
  sso_provider_already_linked: "This Booklet account is already connected to another account at that provider. Disconnect it first.",
  sso_no_email: "That account has no verified email address, so it cannot be connected.",
  sso_email_unverified: "Confirm this account's email address first. Until then you can only connect an account that uses the same address.",
  sso_cancelled: "Connecting was cancelled.",
};

const SCOPE_LABELS: Record<string, string> = { "pages:read": "read your pages", "pages:write": "publish, update and delete pages" };

type Props = {
  email: string;
  needsVerification: boolean;
  hasPassword: boolean;
  providers: Array<{ id: string; label: string; connected: boolean }>;
  passkeys: Array<{ id: string; name: string; created_at: string; last_used_at: string | null }>;
  apps: Array<{ clientId: string; name: string; scope: string[] }>;
  errorCode?: string;
};

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

/** Sends a JSON request and returns an error message, or null when it worked. */
async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (res.ok) return null;
    return ((await res.json().catch(() => ({}))) as { detail?: string }).detail ?? "Something went wrong. Try again.";
  } catch {
    return "Network error. Try again.";
  }
}

const day = (iso: string) => iso.slice(0, 10);

export function AccountClient({ email, needsVerification, hasPassword, providers, passkeys, apps, errorCode }: Props) {
  const router = useRouter();
  const { refetch } = useSession();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(
    errorCode ? { kind: "error", text: LINK_ERRORS[errorCode] ?? "Could not connect that account. Try again." } : null,
  );
  // Decided after hydration: the server cannot know what the browser supports.
  const canUsePasskeys = useHydrated() && browserSupportsWebAuthn();

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  /** Runs one action, reports its result, and reloads the server-rendered lists. */
  async function run(action: () => Promise<string | null>, done: string) {
    setBusy(true);
    setNotice(null);
    const error = await action();
    setNotice(error ? { kind: "error", text: error } : { kind: "ok", text: done });
    setBusy(false);
    if (!error) router.refresh();
    return !error;
  }

  async function changeEmail(e: FormEvent) {
    e.preventDefault();
    const address = newEmail.trim();
    // Where mail is set up a link goes out and nothing changes yet. Where it
    // is not, the address has already changed: the answer says which.
    let changedNow = false;
    const ok = await run(async () => {
      try {
        const res = await fetch("/api/account/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: address, password: emailPassword }),
        });
        const data = (await res.json().catch(() => ({}))) as { changed?: boolean; detail?: string };
        if (!res.ok) return data.detail ?? "Something went wrong. Try again.";
        changedNow = data.changed === true;
        return null;
      } catch {
        return "Network error. Try again.";
      }
    }, "");
    if (!ok) return;
    setNotice({
      kind: "ok",
      text: changedNow
        ? `This account's email address is now ${address}.${needsVerification ? " Use \"Email me the link\" above to confirm it." : ""}`
        : // The same words whether or not a link went out: see the route.
          `If ${address} can be used, we sent it a link. Open it while signed in here and this account moves to that address.`,
    });
    setNewEmail("");
    setEmailPassword("");
    router.refresh();
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    const ok = await run(
      () => send("/api/auth/change-password", "POST", { current_password: currentPassword, new_password: newPassword }),
      "Password saved. Other browsers were signed out and connected apps were disconnected.",
    );
    if (ok) {
      setCurrentPassword("");
      setNewPassword("");
    }
  }

  async function addPasskey() {
    await run(async () => {
      try {
        const options = await fetch("/api/auth/passkey/register", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        if (!options.ok) return ((await options.json().catch(() => ({}))) as { detail?: string }).detail ?? "Could not start. Try again.";
        const response = await startRegistration({ optionsJSON: await options.json() });
        return await send("/api/auth/passkey/register", "POST", { response, name: `Passkey added ${day(new Date().toISOString())}` });
      } catch (e) {
        if (e instanceof Error && e.name === "InvalidStateError") return "This device already has a passkey for this account.";
        if (e instanceof Error && e.name === "NotAllowedError") return "Adding the passkey was cancelled.";
        return "Could not add a passkey on this device.";
      }
    }, "Passkey added. You can sign in with it from now on.");
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    const error = await send("/api/account/delete", "POST", hasPassword ? { password: deleteConfirm } : { confirm_email: deleteConfirm });
    if (error) {
      setNotice({ kind: "error", text: error });
      setBusy(false);
      return;
    }
    await refetch();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {notice && (
        <p role={notice.kind === "error" ? "alert" : "status"} className={`mt-6 text-sm ${notice.kind === "error" ? "text-danger" : "text-text-secondary"}`}>
          {notice.text}
        </p>
      )}

      {needsVerification && (
        <Section title="Confirm your email" hint={`You can write drafts now. Publishing starts once you open the link we email to ${email}.`}>
          <Button variant="secondary" size="md" disabled={busy} onClick={() => void run(() => send("/api/auth/verify-email/send", "POST"), "Sent. Check your inbox.")}>
            Email me the link
          </Button>
        </Section>
      )}

      <Section
        title="Email address"
        hint={`This account's address is ${email}. Sign-in, password resets and team invites all go by it.`}
      >
        <form onSubmit={(e) => void changeEmail(e)} className="max-w-xs space-y-2">
          <input
            type="email"
            aria-label="New email address"
            placeholder="New email address"
            autoComplete="email"
            required
            maxLength={254}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={INPUT}
          />
          {hasPassword && (
            <input
              type="password"
              aria-label="Password, to change the email address"
              placeholder="Your password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              className={INPUT}
            />
          )}
          <Button type="submit" variant="secondary" size="md" disabled={busy}>
            Change email
          </Button>
        </form>
      </Section>

      <Section
        title={hasPassword ? "Change password" : "Set a password"}
        hint="Saving a password signs out your other browsers and disconnects connected apps."
      >
        <form onSubmit={(e) => void changePassword(e)} className="max-w-xs space-y-2">
          {hasPassword && (
            <input
              type="password"
              aria-label="Current password"
              placeholder="Current password"
              autoComplete="current-password"
              required
              maxLength={256}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={INPUT}
            />
          )}
          <input
            type="password"
            aria-label="New password"
            placeholder="New password, at least 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={256}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={INPUT}
          />
          <Button type="submit" variant="secondary" size="md" disabled={busy}>
            {hasPassword ? "Change password" : "Set password"}
          </Button>
        </form>
      </Section>

      {providers.length > 0 && (
        <Section title="Sign-in accounts">
          {providers.map((p) => (
            <div key={p.id} className={ROW}>
              <span className="text-sm">{p.label}</span>
              {p.connected ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void run(() => send(`/api/auth/sso/${p.id}`, "DELETE"), `${p.label} disconnected.`)}
                >
                  Disconnect
                </Button>
              ) : (
                <a href={`/api/auth/sso/${p.id}?connect=1`} className="text-xs font-semibold text-accent transition-colors hover:text-accent-soft">
                  Connect
                </a>
              )}
            </div>
          ))}
        </Section>
      )}

      <Section title="Passkeys" hint="Sign in with your fingerprint, face or device PIN, with no password to type.">
        {passkeys.map((p) => (
          <div key={p.id} className={ROW}>
            <span className="min-w-0">
              <span className="block truncate text-sm">{p.name}</span>
              <span className="block text-xs text-text-muted">{p.last_used_at ? `Last used ${day(p.last_used_at)}` : "Not used yet"}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void run(() => send(`/api/auth/passkey/${encodeURIComponent(p.id)}`, "DELETE"), "Passkey removed.")}
            >
              Remove
            </Button>
          </div>
        ))}
        {canUsePasskeys ? (
          <Button variant="secondary" size="md" disabled={busy} onClick={() => void addPasskey()}>
            Add a passkey
          </Button>
        ) : (
          <p className="text-xs text-text-muted">This browser does not support passkeys.</p>
        )}
      </Section>

      <Section title="Connected apps" hint="Apps you signed in to with Booklet, such as an AI assistant using the MCP server.">
        {apps.length === 0 && <p className="text-xs text-text-muted">No apps are connected.</p>}
        {apps.map((app) => (
          <div key={app.clientId} className={ROW}>
            <span className="min-w-0">
              <span className="block truncate text-sm">{app.name}</span>
              <span className="block text-xs text-text-muted">Can {app.scope.map((s) => SCOPE_LABELS[s] ?? s).join("; ")}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void run(() => send("/api/account/apps", "DELETE", { client_id: app.clientId }), `${app.name} disconnected.`)}
            >
              Disconnect
            </Button>
          </div>
        ))}
      </Section>

      <Section title="Your data" hint="A ZIP file with one Markdown file per page, each with its title, link and visibility as frontmatter.">
        <a
          href="/api/account/export"
          className="inline-flex h-8 items-center rounded-pill border border-border-default px-3.5 text-xs font-semibold text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
        >
          Download all pages
        </a>
      </Section>

      <Section
        title="Delete account"
        hint="Deletes your account, every page you published, their version history, your drafts, API keys and webhooks. Links to your pages stop working. This cannot be undone."
      >
        {deleting ? (
          <form onSubmit={(e) => void deleteAccount(e)} className="max-w-xs space-y-2">
            <input
              type={hasPassword ? "password" : "email"}
              aria-label={hasPassword ? "Password" : "Email address"}
              placeholder={hasPassword ? "Your password" : `Type ${email} to confirm`}
              autoComplete={hasPassword ? "current-password" : "off"}
              required
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className={INPUT}
            />
            <div className="flex gap-2">
              <Button type="submit" variant="danger" size="md" disabled={busy}>
                Delete my account and pages
              </Button>
              <Button type="button" variant="ghost" size="md" onClick={() => setDeleting(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="danger" size="md" onClick={() => setDeleting(true)}>
            Delete account
          </Button>
        )}
      </Section>
    </>
  );
}
