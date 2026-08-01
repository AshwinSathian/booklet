"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";

const INPUT_CLASS =
  "w-full rounded-lg border border-border-default bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setSubmitting(false);
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm text-text-secondary text-center">
        If that email has an account, a reset link is on its way. Check your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="w-full max-w-xs space-y-3">
      <div>
        <label htmlFor="email" className="sr-only">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <Button type="submit" variant="primary" size="md" disabled={submitting} className="w-full justify-center">
        {submitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
