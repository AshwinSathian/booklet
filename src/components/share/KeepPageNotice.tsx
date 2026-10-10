"use client";

import { useState } from "react";

/**
 * Shown on an unclaimed anonymous page, and only in the browser that
 * published it (the server checks the claim cookie before rendering this —
 * see src/lib/anonymous-claim.ts). Readers never see it.
 */
export function KeepPageNotice({
  pageId,
  expiresOn,
  deletedOn,
  signedIn,
}: {
  pageId: string;
  /** Already formatted on the server, so server and client render the same text. */
  expiresOn: string;
  /** Set once the page has expired: readers already get 410, and this is when it is deleted. */
  deletedOn: string | null;
  signedIn: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function keep() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/claim`, { method: "POST" });
      if (res.ok) {
        window.location.reload();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not keep this page. Try again.");
    } catch {
      setError("Could not keep this page. Try again.");
    }
    setBusy(false);
  }

  return (
    <div
      data-testid="keep-page-notice"
      className="border-b border-accent/20 bg-accent-dim/60 px-4 py-2.5 print:hidden"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-xs text-text-secondary">
          <span className="font-semibold text-text-primary">
            {deletedOn
              ? `This page expired on ${expiresOn} and will be deleted on ${deletedOn}.`
              : `This page expires on ${expiresOn}.`}
          </span>{" "}
          {deletedOn
            ? "Nobody else can open it now. Only you can see this notice."
            : "You published it without an account. Only you can see this notice."}
          {error ? <span className="block text-red-400">{error}</span> : null}
        </p>
        {signedIn ? (
          <button
            type="button"
            onClick={keep}
            disabled={busy}
            className="shrink-0 rounded-pill bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-contrast transition hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? "Keeping…" : "Keep this page"}
          </button>
        ) : (
          <a
            href={`/sign-in?redirect_url=${encodeURIComponent(`/p/${pageId}`)}`}
            className="shrink-0 rounded-pill bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-contrast transition hover:bg-accent-hover"
          >
            Sign in to keep this page
          </a>
        )}
      </div>
    </div>
  );
}
