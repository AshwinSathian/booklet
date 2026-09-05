"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function CliAuthorizeConfirm({ port, state }: { port: string; state: string }) {
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function authorize() {
    setStatus("working");
    setError(null);
    try {
      const res = await fetch("/api/auth/cli-authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port, state }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.callbackUrl) {
        setStatus("error");
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      window.location.href = data.callbackUrl;
    } catch {
      setStatus("error");
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="text-center space-y-4">
      <p className="text-3xl">🔑</p>
      <div className="space-y-1.5">
        <h1 className="text-base font-semibold">Authorize the Booklet CLI?</h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          A CLI on this computer (listening on port <span className="font-mono">{port}</span>) is
          requesting an API key for your account. Only continue if you just ran{" "}
          <span className="font-mono">booklet login</span> yourself.
        </p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center justify-center gap-3 pt-1">
        <Button href="/my-pages" variant="secondary" size="lg">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={authorize}
          disabled={status === "working"}
        >
          {status === "working" ? "Authorizing…" : "Authorize"}
        </Button>
      </div>
    </div>
  );
}
