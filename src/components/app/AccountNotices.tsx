"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/SessionProvider";
import { ROUTES } from "@/lib/constants";
import { answerDraftAdoption, listUnclaimedDrafts } from "@/lib/drafts/cloud-sync";

const BAR = "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border-subtle bg-bg-soft px-4 py-2 text-xs text-text-secondary";
const ACTION = "font-semibold text-accent transition-colors hover:text-accent-soft disabled:opacity-50";

/**
 * Two things a signed-in writer is told above the editor: that the email
 * address still needs confirming before anything can be published, and,
 * once per account in this browser, that drafts written before signing in
 * can be moved into the account.
 */
export function AccountNotices() {
  const { isLoaded, userId, emailVerified } = useSession();
  const [unclaimed, setUnclaimed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<"idle" | "sent" | "failed">("idle");

  useEffect(() => {
    setUnclaimed(isLoaded && userId ? listUnclaimedDrafts(userId).length : 0);
  }, [isLoaded, userId]);

  if (!userId) return null;

  async function answer(adopt: boolean) {
    if (!userId) return;
    setBusy(true);
    await answerDraftAdoption(userId, adopt);
    setBusy(false);
    setUnclaimed(0);
  }

  async function resend() {
    setBusy(true);
    const res = await fetch("/api/auth/verify-email/send", { method: "POST" }).catch(() => null);
    setSent(res?.ok ? "sent" : "failed");
    setBusy(false);
  }

  return (
    <>
      {!emailVerified && (
        <div role="status" className={BAR}>
          <span>Confirm your email address to publish.</span>
          {sent === "sent" ? (
            <span>Link sent. Check your inbox.</span>
          ) : (
            <button type="button" disabled={busy} onClick={() => void resend()} className={ACTION}>
              {sent === "failed" ? "Could not send. Try again" : "Email me the link"}
            </button>
          )}
          <Link href={ROUTES.account} className={ACTION}>Account settings</Link>
        </div>
      )}
      {unclaimed > 0 && (
        <div role="status" className={BAR}>
          <span>
            {unclaimed === 1
              ? "1 draft on this device is not in your account."
              : `${unclaimed} drafts on this device are not in your account.`}{" "}
            Move {unclaimed === 1 ? "it" : "them"} in to sync across devices?
          </span>
          <button type="button" disabled={busy} onClick={() => void answer(true)} className={ACTION}>
            {unclaimed === 1 ? "Move draft" : "Move drafts"}
          </button>
          <button type="button" disabled={busy} onClick={() => void answer(false)} className="text-text-muted transition-colors hover:text-text-primary">
            Keep on this device only
          </button>
        </div>
      )}
    </>
  );
}
