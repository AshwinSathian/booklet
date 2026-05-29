"use client";

import { useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

// Check platform authenticator availability once (cached across renders).
let passkeyAvailabilityCache: boolean | null = null;

async function isPasskeyAvailable(): Promise<boolean> {
  if (passkeyAvailabilityCache !== null) return passkeyAvailabilityCache;
  if (
    typeof window === "undefined" ||
    !window.PublicKeyCredential ||
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== "function"
  ) {
    passkeyAvailabilityCache = false;
    return false;
  }
  try {
    passkeyAvailabilityCache =
      await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return passkeyAvailabilityCache;
  } catch {
    passkeyAvailabilityCache = false;
    return false;
  }
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "Unknown";
  try {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Unknown";
  }
}

export function PasskeySection() {
  const { user, isLoaded } = useUser();
  const [supported, setSupported] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    isPasskeyAvailable().then(setSupported);
  }, []);

  const createPasskey = useCallback(async () => {
    if (!user) return;
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      await user.createPasskey();
      setSuccess("Passkey registered. You can now sign in with biometrics or your device PIN.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create passkey.";
      if (!msg.toLowerCase().includes("cancel") && !msg.toLowerCase().includes("abort")) {
        setError(msg);
      }
    } finally {
      setCreating(false);
    }
  }, [user]);

  const deletePasskey = useCallback(
    async (passkeyId: string, name: string) => {
      if (!user) return;
      setDeletingId(passkeyId);
      setError(null);
      setSuccess(null);
      try {
        const passkey = user.passkeys.find((p) => p.id === passkeyId);
        if (!passkey) return;
        await passkey.delete();
        setSuccess(`Passkey "${name}" removed.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove passkey.");
      } finally {
        setDeletingId(null);
      }
    },
    [user],
  );

  if (!isLoaded) return null;
  // Hide the entire section if the user's device can't use passkeys.
  if (!supported) return null;

  const passkeys = user?.passkeys ?? [];

  return (
    <section className="mt-10 border-t border-border-subtle pt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base">Passkeys</h2>
          <p className="mt-0.5 text-sm text-text-secondary">
            Sign in instantly with your device&apos;s biometrics or PIN — no password needed.
          </p>
        </div>
        <button
          type="button"
          onClick={createPasskey}
          disabled={creating}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-pill bg-accent px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? (
            <SpinnerIcon />
          ) : (
            <PlusIcon />
          )}
          {creating ? "Registering…" : "Add passkey"}
        </button>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-3 rounded-lg border border-green-500/20 bg-green-500/8 px-3 py-2 text-xs text-green-400">
          {success}
        </div>
      ) : null}

      {passkeys.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-5">
          <div className="text-sm font-medium text-text-primary">No passkeys yet</div>
          <div className="mt-1 text-sm text-text-secondary leading-relaxed">
            Add a passkey to sign in with Touch ID, Face ID, or Windows Hello — faster and
            more secure than a password.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {passkeys.map((pk) => (
            <div
              key={pk.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-bg-elevated px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <PasskeyIcon />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-text-primary">
                    {pk.name || "Passkey"}
                  </div>
                  <div className="text-xs text-text-muted">
                    Added {formatDate(pk.createdAt)}
                    {pk.lastUsedAt ? ` · Last used ${formatDate(pk.lastUsedAt)}` : ""}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void deletePasskey(pk.id, pk.name || "passkey")}
                disabled={deletingId === pk.id}
                className="shrink-0 rounded-lg border border-border-subtle px-3 py-1 text-xs text-text-muted transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingId === pk.id ? "Removing…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PasskeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0 text-text-muted">
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

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 13 13" fill="none" className="animate-spin" aria-hidden>
      <path d="M6.5 1a5.5 5.5 0 1 0 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
