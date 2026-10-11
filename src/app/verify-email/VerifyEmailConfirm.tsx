"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/auth/SessionProvider";
import { ROUTES } from "@/lib/constants";

export function VerifyEmailConfirm({ token }: { token: string }) {
  const { refetch, isLoaded, isSignedIn } = useSession();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(token ? null : "This link is missing its token. Open the link from the email again.");

  async function confirm() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setState("done");
        void refetch();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(data.detail ?? "Could not confirm the address. Try again.");
    } catch {
      setError("Network error. Try again.");
    }
    setState("idle");
  }

  if (state === "done") {
    return (
      <div className="space-y-3 text-center">
        <p role="status" className="text-sm text-text-secondary">Your email is confirmed. You can publish now.</p>
        <Link href={ROUTES.app} className="text-sm text-accent transition-colors hover:text-accent-soft">
          Open the editor
        </Link>
      </div>
    );
  }

  // Confirming needs the account's own session (see the route).
  if (isLoaded && !isSignedIn) {
    return (
      <div className="w-full max-w-xs space-y-3 text-center">
        <p className="text-sm text-text-secondary">Sign in to the account this link was sent for, and you will come back here to confirm.</p>
        <Link
          href={`${ROUTES.signIn}?redirect_url=${encodeURIComponent(`/verify-email?token=${encodeURIComponent(token)}`)}`}
          className="text-sm font-semibold text-accent transition-colors hover:text-accent-soft"
        >
          Sign in
        </Link>
        <p className="text-xs text-text-muted">
          If you did not create this account, do not sign in to it. Use{" "}
          <Link href={ROUTES.forgotPassword} className="text-accent underline underline-offset-2 hover:text-accent-soft">Forgot your password</Link> to take the address back.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs space-y-3 text-center">
      <p className="text-sm text-text-secondary">Confirm this email address for your Booklet account.</p>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <Button
        type="button"
        variant="primary"
        size="md"
        disabled={state === "sending" || !token}
        onClick={() => void confirm()}
        className="w-full justify-center"
      >
        {state === "sending" ? "Please wait…" : "Confirm email"}
      </Button>
    </div>
  );
}
