"use client";

import { Button } from "@/components/ui/Button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-2xl border border-border-default bg-bg-elevated p-8 text-center">
        <h1 className="font-display text-2xl font-medium">Something went wrong</h1>
        <p className="mt-3 text-sm text-text-secondary">The editor hit an unexpected error. Try again.</p>

        <div className="mt-6 flex justify-center">
          <Button variant="primary" size="lg" onClick={reset}>
            Try again
          </Button>
        </div>

        {error?.digest ? (
          <div className="mt-5 text-xs text-text-muted">Ref: {error.digest}</div>
        ) : null}
      </div>
    </main>
  );
}
