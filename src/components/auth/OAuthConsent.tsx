"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const SCOPE_TEXT: Record<string, string> = {
  "pages:read": "Read your pages, including unlisted ones",
  "pages:write": "Publish, update and delete pages",
};

export function OAuthConsent({
  params,
  clientName,
  clientHost,
  destination,
  scope,
}: {
  params: Record<string, string | undefined>;
  clientName: string | null;
  clientHost: string | null;
  destination: string;
  scope: string[];
}) {
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "deny") {
    setStatus("working");
    setError(null);
    try {
      const res = await fetch("/api/oauth/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params, decision }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.redirect) {
        setStatus("error");
        setError(data?.detail ?? "Something went wrong. Try again.");
        return;
      }
      window.location.href = data.redirect;
      // An https redirect unloads this page. A native app's own scheme
      // (cursor://, vscode://) does not, so give the buttons back in case
      // the hand-off was dismissed and the user wants to try again.
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setError("Something went wrong. Try again.");
    }
  }

  const name = clientName ?? clientHost ?? "An app";

  return (
    <div className="text-center space-y-4">
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl font-medium leading-tight tracking-[-0.02em]">Connect {name} to Booklet?</h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          {clientHost && clientName ? (
            <>
              This app is published at <span className="font-mono">{clientHost}</span>.{" "}
            </>
          ) : null}
          If you allow it, access goes to <span className="font-mono">{destination}</span>. Only continue if you
          started this from an app you trust.
        </p>
      </div>
      <ul className="text-left text-sm text-text-secondary space-y-1.5 rounded-lg border border-border-default p-3">
        {scope.map((s) => (
          <li key={s}>• {SCOPE_TEXT[s] ?? s}</li>
        ))}
      </ul>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex items-center justify-center gap-3 pt-1">
        <Button variant="secondary" size="lg" onClick={() => decide("deny")} disabled={status === "working"}>
          Cancel
        </Button>
        <Button variant="primary" size="lg" onClick={() => decide("approve")} disabled={status === "working"}>
          {status === "working" ? "Connecting…" : "Allow"}
        </Button>
      </div>
    </div>
  );
}
