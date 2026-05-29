"use client";

// Clerk v7 uses a signals-based API: useSignIn() → { signIn, fetchStatus, errors }
// signIn.passkey({ flow }) is the new method (not authenticateWithPasskey).
import { useSignIn } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

async function passkeySupported(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !window.PublicKeyCredential ||
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function"
  ) {
    return false;
  }
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function PasskeySignInButton() {
  const { signIn, fetchStatus } = useSignIn();
  const [supported, setSupported] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = fetchStatus === "idle";

  useEffect(() => {
    passkeySupported().then(setSupported);
  }, []);

  // Trigger conditional-UI autofill so the browser can suggest passkeys in
  // the email field rendered by the <SignIn> component below.
  useEffect(() => {
    if (!ready || !supported) return;
    signIn.passkey({ flow: "autofill" }).catch(() => {});
  }, [ready, supported, signIn]);

  const handleClick = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const { error: clerkErr } = await signIn.passkey({ flow: "discoverable" });
      if (clerkErr) {
        const msg = clerkErr.message ?? "Passkey sign-in failed.";
        if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("abort")) {
          setError(msg);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Passkey sign-in failed.";
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("abort")) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [ready, signIn]);

  if (!supported) return null;

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !ready}
        className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-outline bg-bg-elevated px-4 py-2.5 text-sm font-medium text-text-primary transition hover:border-accent-soft/50 hover:bg-accent/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <PasskeyIcon />
        {loading ? "Checking passkey…" : "Sign in with passkey"}
      </button>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 h-px bg-border-subtle" />
        <span className="text-xs text-text-muted">or</span>
        <div className="flex-1 h-px bg-border-subtle" />
      </div>
    </div>
  );
}

function PasskeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2 20c0-3.314 2.686-6 6-6M16 14l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
