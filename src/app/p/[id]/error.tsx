"use client";

import { ROUTES } from "@/lib/constants";
import Link from "next/link";

export default function ShareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-2xl border border-border-default bg-bg-soft p-6 text-center shadow-glass">
        <div className="text-lg font-semibold uppercase tracking-wide">
          Couldn&apos;t load this page
        </div>
        <div className="mt-3 text-sm text-text-secondary">
          The link may be incorrect, or something went wrong on our end.
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 14 14" aria-hidden>
              <path d="M12 7A5 5 0 1 1 7 2a5 5 0 0 0 3.54 1.46M12 2v3.5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Retry
          </button>
          <Link
            href={ROUTES.app}
            className="inline-flex items-center gap-2 rounded-pill border border-border-default px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:border-border-strong hover:text-text-primary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Open editor
          </Link>
        </div>

        {error?.digest ? (
          <div className="mt-5 text-xs text-text-muted">Ref: {error.digest}</div>
        ) : null}
      </div>
    </main>
  );
}
