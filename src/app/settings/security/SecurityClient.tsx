"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { Button, buttonClass } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import { useHydrated } from "@/lib/ui/hydration";
import { SettingsRow, SettingsSection, StatusChip } from "../SettingsShell";
import { send } from "../request";

const LINK_ERRORS: Record<string, string> = {
  sso_identity_taken: "That account already signs in to a different Booklet account.",
  sso_provider_already_linked: "This Booklet account is already connected to another account at that provider. Disconnect it first.",
  sso_no_email: "That account has no verified email address, so it cannot be connected.",
  sso_email_unverified: "Confirm this account's email address first. Until then you can only connect an account that uses the same address.",
  sso_cancelled: "Connecting was cancelled.",
};

const SCOPE_LABELS: Record<string, string> = { "pages:read": "read your pages", "pages:write": "publish, update and delete pages" };

type Props = {
  hasPassword: boolean;
  providers: Array<{ id: string; label: string; connected: boolean }>;
  passkeys: Array<{ id: string; name: string; added: string; lastUsed: string | null }>;
  apps: Array<{ clientId: string; name: string; scope: string[] }>;
  sessions: number;
  errorCode?: string;
};

const LABEL = "flex flex-col gap-1.5 text-sm font-medium text-text-primary";

export function SecurityClient({ hasPassword, providers, passkeys, apps, sessions, errorCode }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const linkError = errorCode ? (LINK_ERRORS[errorCode] ?? "Could not connect that account. Try again.") : null;
  // Decided after hydration: the server cannot know what the browser supports.
  const canUsePasskeys = useHydrated() && browserSupportsWebAuthn();

  // The address carried the error here from the provider; a reload should not show it again.
  useEffect(() => {
    if (errorCode) window.history.replaceState(null, "", window.location.pathname);
  }, [errorCode]);

  /** Runs one action, says how it went, and reloads the server-rendered lists. */
  async function run(action: () => Promise<string | null>, done: string, detail?: string) {
    setBusy(true);
    const error = await action();
    setBusy(false);
    if (error) toast.error(error);
    else {
      toast.success(done, detail);
      router.refresh();
    }
  }

  async function addPasskey() {
    await run(async () => {
      try {
        const options = await fetch("/api/auth/passkey/register", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        if (!options.ok) return ((await options.json().catch(() => ({}))) as { detail?: string }).detail ?? "Could not start. Try again.";
        const response = await startRegistration({ optionsJSON: await options.json() });
        return await send("/api/auth/passkey/register", "POST", { response, name: `Passkey added ${new Date().toISOString().slice(0, 10)}` });
      } catch (e) {
        if (e instanceof Error && e.name === "InvalidStateError") return "This device already has a passkey for this account.";
        if (e instanceof Error && e.name === "NotAllowedError") return "Adding the passkey was cancelled.";
        return "Could not add a passkey on this device.";
      }
    }, "Passkey added", "You can sign in with it from now on.");
  }

  const others = Math.max(0, sessions - 1);

  return (
    <>
      {linkError && (
        <p role="alert" className="mb-8 rounded-xl border border-danger/40 px-4 py-3 text-sm text-danger sm:px-5">
          {linkError}
        </p>
      )}

      <SettingsSection title="Password">
        <SettingsRow
          label={hasPassword ? "A password is set" : "No password"}
          detail={
            hasPassword
              ? "Changing it signs out your other browsers and disconnects connected apps."
              : "You sign in without one. Setting a password signs out your other browsers and disconnects connected apps."
          }
          action={
            <Button variant="secondary" size="md" onClick={() => setPasswordOpen(true)}>
              {hasPassword ? "Change password" : "Set a password"}
            </Button>
          }
        />
      </SettingsSection>

      {providers.length > 0 && (
        <SettingsSection title="Sign-in accounts" hint="Sign in to Booklet with an account you already have.">
          {providers.map((p) => (
            <SettingsRow
              key={p.id}
              label={
                <>
                  {p.label}
                  {p.connected && <StatusChip>Connected</StatusChip>}
                </>
              }
              action={
                p.connected ? (
                  <Button variant="secondary" size="md" disabled={busy} onClick={() => void run(() => send(`/api/auth/sso/${p.id}`, "DELETE"), `${p.label} disconnected`)}>
                    Disconnect
                  </Button>
                ) : (
                  <a href={`/api/auth/sso/${p.id}?connect=1`} className={buttonClass("secondary", "md")}>
                    Connect
                  </a>
                )
              }
            />
          ))}
        </SettingsSection>
      )}

      <SettingsSection title="Passkeys" hint="Sign in with your fingerprint, face or device PIN, with no password to type.">
        {passkeys.map((p) => (
          <SettingsRow
            key={p.id}
            label={<span className="break-words">{p.name}</span>}
            detail={`Added ${p.added}. ${p.lastUsed ? `Last used ${p.lastUsed}.` : "Not used yet."}`}
            action={
              <Button
                variant="secondary"
                size="md"
                disabled={busy}
                onClick={() => void run(() => send(`/api/auth/passkey/${encodeURIComponent(p.id)}`, "DELETE"), "Passkey removed")}
              >
                Remove
              </Button>
            }
          />
        ))}
        <SettingsRow
          label={passkeys.length ? "Another device" : "No passkeys yet"}
          detail={canUsePasskeys ? "A passkey is kept by this device or your password manager." : "This browser does not support passkeys."}
          action={
            canUsePasskeys ? (
              <Button variant="secondary" size="md" disabled={busy} onClick={() => void addPasskey()}>
                Add a passkey
              </Button>
            ) : undefined
          }
        />
      </SettingsSection>

      <SettingsSection title="Browsers">
        <SettingsRow
          label={others === 0 ? "Signed in on this browser" : `Signed in on this browser and ${others} other${others === 1 ? "" : "s"}`}
          detail="A browser you stop using is signed out within 30 days."
          action={
            <Button
              variant="secondary"
              size="md"
              disabled={busy || others === 0}
              onClick={() => void run(() => send("/api/auth/logout-others", "POST"), "Signed out of your other browsers")}
            >
              Sign out the others
            </Button>
          }
        />
      </SettingsSection>

      <SettingsSection title="Connected apps" hint="Apps you signed in to with Booklet, such as an AI assistant using the MCP server.">
        {apps.length === 0 && <SettingsRow label="No apps are connected" />}
        {apps.map((app) => (
          <SettingsRow
            key={app.clientId}
            label={<span className="break-words">{app.name}</span>}
            detail={`Can ${app.scope.map((s) => SCOPE_LABELS[s] ?? s).join("; ")}.`}
            action={
              <Button
                variant="secondary"
                size="md"
                disabled={busy}
                onClick={() => void run(() => send("/api/account/apps", "DELETE", { client_id: app.clientId }), `${app.name} disconnected`)}
              >
                Disconnect
              </Button>
            }
          />
        ))}
      </SettingsSection>

      <Dialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title={hasPassword ? "Change password" : "Set a password"}
        description="Saving a password signs out your other browsers and disconnects connected apps."
      >
        <PasswordForm
          hasPassword={hasPassword}
          onClose={() => setPasswordOpen(false)}
          onSaved={() => {
            setPasswordOpen(false);
            toast.success("Password saved", "Other browsers were signed out and connected apps were disconnected.");
            router.refresh();
          }}
        />
      </Dialog>
    </>
  );
}

function PasswordForm({ hasPassword, onClose, onSaved }: { hasPassword: boolean; onClose: () => void; onSaved: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const failed = await send("/api/auth/change-password", "POST", { current_password: current, new_password: next });
    setBusy(false);
    if (failed) setError(failed);
    else onSaved();
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
      {hasPassword && (
        <label className={LABEL}>
          Current password
          <input type="password" autoFocus autoComplete="current-password" required maxLength={256} value={current} onChange={(e) => setCurrent(e.target.value)} className="field font-normal" />
        </label>
      )}
      <label className={LABEL}>
        New password
        <input
          type="password"
          autoFocus={!hasPassword}
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={256}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-describedby="new-password-rule"
          className="field font-normal"
        />
        <span id="new-password-rule" className="text-xs font-normal text-text-muted">At least 8 characters.</span>
      </label>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={busy}>
          {busy ? "Saving…" : hasPassword ? "Change password" : "Set password"}
        </Button>
      </div>
    </form>
  );
}
