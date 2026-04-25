"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-2xl border border-outline bg-bg-soft p-6 text-center shadow-glass">
        <div className="text-lg font-semibold uppercase tracking-wide">
          Something went wrong
        </div>
        <div className="mt-3 text-sm text-text-secondary">
          The editor hit an unexpected error. Try again.
        </div>

        <div className="mt-6 flex justify-center">
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
        </div>

        {error?.digest ? (
          <div className="mt-5 text-xs text-text-muted">Ref: {error.digest}</div>
        ) : null}
      </div>
    </main>
  );
}
