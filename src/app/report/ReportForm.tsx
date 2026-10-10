"use client";

import { useState } from "react";
import { getTurnstileToken } from "@/lib/turnstile-client";
import type { ReportReason } from "@/lib/db/types";

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: "spam", label: "Spam or advertising" },
  { value: "phishing", label: "Phishing or a fake login page" },
  { value: "malware", label: "Malware or a harmful download" },
  { value: "illegal", label: "Illegal content" },
  { value: "harassment", label: "Harassment or threats" },
  { value: "copyright", label: "Copyright infringement" },
  { value: "other", label: "Something else" },
];

const FIELD =
  "w-full rounded-lg border border-border-default bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft";

export function ReportForm({ pageId }: { pageId: string }) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [detail, setDetail] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          reason,
          detail,
          reporter_email: email,
          turnstile_token: await getTurnstileToken(),
        }),
      });
      if (res.ok) {
        setState("sent");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Could not send the report. Try again.");
    } catch (e) {
      setError(e instanceof Error && e.message.includes("robot") ? e.message : "Could not send the report. Try again.");
    }
    setState("idle");
  }

  if (state === "sent") {
    return (
      <p role="status" className="text-sm text-text-secondary">
        Report sent. Thank you.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
        What is wrong with this page?
        <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} className={FIELD}>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
        Details (optional)
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          maxLength={2000}
          rows={4}
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
        Your email (optional, used only to reply to you)
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={254}
          autoComplete="email"
          className={FIELD}
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={state === "sending"}
        className="self-start rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition hover:bg-accent-hover disabled:opacity-50"
      >
        {state === "sending" ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}
