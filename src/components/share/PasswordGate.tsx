"use client";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { useState } from "react";

export function PasswordGate({ pageId }: { pageId: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Reload so the server renders the full page with cookie set.
        window.location.reload();
      } else {
        const data = (await res.json()) as { detail?: string };
        setError(data.detail ?? "Incorrect password");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="This page has a password">
      <p className="text-center text-sm text-text-secondary">Enter it to read the page.</p>
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <label htmlFor="page-password" className="sr-only">Password</label>
        <input
          id="page-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "page-password-error" : undefined}
          className="w-full field"
        />
        {error && (
          <p id="page-password-error" role="alert" className="text-sm text-danger">{error}</p>
        )}
        <Button type="submit" variant="primary" size="lg" disabled={loading || !password.trim()} className="w-full justify-center">
          {loading ? "Checking…" : "Open page"}
        </Button>
      </form>
    </AuthLayout>
  );
}
