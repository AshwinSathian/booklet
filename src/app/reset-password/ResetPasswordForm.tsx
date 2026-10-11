"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";

const INPUT_CLASS =
  "w-full field";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);

    const data = (await res?.json().catch(() => ({}))) as { detail?: string } | undefined;

    if (!res || !res.ok) {
      setError(data?.detail ?? "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    router.push(ROUTES.signIn);
  }

  if (!token) {
    return <p className="text-sm text-danger text-center">This reset link is missing its token.</p>;
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="w-full space-y-3">
      <div>
        <label htmlFor="password" className="sr-only">New password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={256}
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" variant="primary" size="lg" disabled={submitting} className="w-full justify-center">
        {submitting ? "Please wait…" : "Reset password"}
      </Button>
    </form>
  );
}
