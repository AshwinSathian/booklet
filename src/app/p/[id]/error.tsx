"use client";

import { ROUTES } from "@/lib/constants";
import Link from "next/link";
import { Button } from "primereact/button";

export default function ShareError({
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
          Couldn’t load this page
        </div>
        <div className="mt-3 text-sm text-text-secondary">
          This can happen if the link expired, the backend is unavailable, or
          the page failed to render.
        </div>

        <div className="mt-6 flex justify-center gap-2">
          <Button
            label="Retry"
            icon="pi pi-refresh"
            onClick={reset}
            rounded
            className="uppercase tracking-wide"
          />
          <Link href={ROUTES.app}>
            <Button
              label="Open editor"
              icon="pi pi-pencil"
              severity="secondary"
              outlined
              rounded
              className="uppercase tracking-wide"
            />
          </Link>
        </div>

        <div className="mt-5 text-[12px] text-text-muted">
          {error?.digest ? `Ref: ${error.digest}` : null}
        </div>
      </div>
    </main>
  );
}
