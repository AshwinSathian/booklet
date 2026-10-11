"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";

export function CreateSpaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => ({}))) as { slug?: string; detail?: string };
      if (!res.ok || !data.slug) {
        setError(data.detail ?? "The space was not created. Try again.");
        return;
      }
      router.push(ROUTES.space(data.slug));
    } catch {
      setError("The space was not created. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-start gap-2">
      <div className="min-w-0 flex-1">
        <label htmlFor="space-name" className="sr-only">
          Space name
        </label>
        <input
          id="space-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          placeholder="Platform team"
          aria-describedby={error ? "space-error" : undefined}
          className="h-10 w-full rounded-lg border border-border-strong bg-bg-elevated px-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
        />
        {error && (
          <p id="space-error" role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" variant="primary" size="lg" disabled={busy || !name.trim()}>
        {busy ? "Creating…" : "Create space"}
      </Button>
    </form>
  );
}
