"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { getTurnstileToken } from "@/lib/turnstile-client";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/auth/SessionProvider";

const INPUT_CLASS =
  "w-full rounded-lg border border-border-default bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft";

const SSO_ERRORS: Record<string, string> = {
  sso_state: "That sign-in did not start in this browser, or it took too long. Try again.",
  sso_cancelled: "Sign-in was cancelled.",
  sso_no_email: "That account has no verified email address, so it cannot be used to sign in.",
  sso_failed: "Could not sign in with that provider. Try again.",
  sso_email_unverified:
    "A Booklet account already uses that email address, and the address has not been confirmed. If the account is yours, sign in with its password and confirm the email. If you never created it, use Forgot your password to take the address back. Then try again.",
};

const ALT_BUTTON =
  "flex h-9 w-full items-center justify-center rounded-pill border border-border-default text-xs font-semibold text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft disabled:opacity-40";

export function AuthForm({
  mode,
  redirectUrl,
  providers = [],
  errorCode,
}: {
  mode: "sign-in" | "sign-up";
  redirectUrl?: string;
  /** Sign-in providers configured on this server. None configured, no buttons. */
  providers?: Array<{ id: string; label: string }>;
  /** `?error=` from a provider sign-in that failed. */
  errorCode?: string;
}) {
  const router = useRouter();
  const { refetch } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(errorCode ? (SSO_ERRORS[errorCode] ?? SSO_ERRORS.sso_failed) : null);
  const [submitting, setSubmitting] = useState(false);
  // Decided after mount: the server cannot know what the browser supports.
  const [passkeys, setPasskeys] = useState(false);
  useEffect(() => setPasskeys(mode === "sign-in" && browserSupportsWebAuthn()), [mode]);

  async function finish() {
    await refetch();
    router.push(redirectUrl ?? "/app");
    router.refresh();
  }

  async function handlePasskey() {
    setError(null);
    setSubmitting(true);
    try {
      const post = (body: unknown) =>
        fetch("/api/auth/passkey/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const options = await post({});
      if (!options.ok) throw new Error();
      const response = await startAuthentication({ optionsJSON: await options.json() });
      const res = await post({ response });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "That passkey could not be verified. Try again.");
        setSubmitting(false);
        return;
      }
      await finish();
    } catch (e) {
      // Closing the browser's passkey prompt is not an error worth a message.
      if (!(e instanceof Error && e.name === "NotAllowedError")) setError("Could not sign in with a passkey. Try again.");
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(mode === "sign-in" ? "/api/auth/login" : "/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(mode === "sign-up" ? { turnstile_token: await getTurnstileToken() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      await finish();
    } catch (e) {
      setError(e instanceof Error && e.message.includes("robot") ? e.message : "Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="w-full max-w-xs space-y-3">
      <div>
        <label htmlFor="email" className="sr-only">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div>
        <label htmlFor="password" className="sr-only">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          required
          minLength={mode === "sign-up" ? 8 : undefined}
          maxLength={256}
          placeholder={mode === "sign-up" ? "At least 8 characters" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>

      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

      <Button type="submit" variant="primary" size="md" disabled={submitting} className="w-full justify-center">
        {submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>

      {(providers.length > 0 || passkeys) && (
        <div className="space-y-2 border-t border-border-subtle pt-3">
          {providers.map((p) => (
            <a
              key={p.id}
              href={`/api/auth/sso/${p.id}${redirectUrl ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`}
              className={ALT_BUTTON}
            >
              Continue with {p.label}
            </a>
          ))}
          {passkeys && (
            <button type="button" disabled={submitting} onClick={() => void handlePasskey()} className={ALT_BUTTON}>
              Sign in with a passkey
            </button>
          )}
        </div>
      )}
    </form>
  );
}
