"use client";

import { Button } from "primereact/button";

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

        <div className="mt-6 flex justify-center gap-2">
          <Button
            label="Retry"
            icon="pi pi-refresh"
            onClick={reset}
            rounded
            className="uppercase tracking-wide"
          />
        </div>

        <div className="mt-5 text-[12px] text-text-muted">
          {error?.digest ? `Ref: ${error.digest}` : null}
        </div>
      </div>
    </main>
  );
}
