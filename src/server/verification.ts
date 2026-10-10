import type { NextResponse } from "next/server";
import { createEmailVerificationToken, getUserById, hasLiveEmailVerificationToken } from "@/lib/db/auth";
import type { DbUser } from "@/lib/db/types";
import { generatePasswordResetToken, hashPasswordResetToken } from "@/lib/auth/password-reset-token";
import { sendVerificationEmail } from "@/lib/email";
import { logError } from "@/lib/logger";
import { ServiceError, toErrorResponse } from "./errors";

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Verification is enforced only where a verification email can be sent.
 * Without RESEND_API_KEY (a self-hosted install with no mail, CI, local
 * development) accounts publish as before, because nobody could ever
 * receive the link.
 */
export function emailVerificationRequired(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function isVerified(user: Pick<DbUser, "email_verified_at"> | null): boolean {
  return !emailVerificationRequired() || Boolean(user?.email_verified_at);
}

export const UNVERIFIED_MESSAGE =
  "Confirm your email address before publishing. Open the link we emailed you, or send a new one from Account settings.";

/**
 * An account with an unconfirmed address can write drafts and cannot
 * publish, update a published page, or create credentials (API keys, CLI
 * and app sign-ins). The credential rule is what makes linking a provider
 * sign-in by email safe: whoever registered an address they do not own
 * holds nothing that outlives the real owner's arrival. It applies to every
 * way in: browser session, API key and OAuth token.
 */
export async function assertVerified(userId: string): Promise<void> {
  if (!emailVerificationRequired()) return;
  if (!(await getUserById(userId))?.email_verified_at) {
    throw new ServiceError("EMAIL_UNVERIFIED", UNVERIFIED_MESSAGE, 403);
  }
}

/** Token hash for a verification link. Shares the reset-token pepper under its own prefix, so one can never pass for the other. */
export function hashVerificationToken(raw: string): Promise<string> {
  return hashPasswordResetToken(`verify:${raw}`);
}

/**
 * Mails a fresh verification link, in the background. With `onlyIfNoneLive`
 * (sign-in) nothing is sent while an earlier link still works, so signing
 * in repeatedly does not send repeated mail.
 */
export async function sendVerification(user: DbUser, origin: string, opts?: { onlyIfNoneLive?: boolean }): Promise<void> {
  if (!emailVerificationRequired() || !user.email || user.email_verified_at) return;
  if (opts?.onlyIfNoneLive && (await hasLiveEmailVerificationToken(user.id))) return;

  const raw = generatePasswordResetToken();
  await createEmailVerificationToken(user.id, user.email, await hashVerificationToken(raw), new Date(Date.now() + VERIFY_TTL_MS));
  sendVerificationEmail(user.email, `${origin}/verify-email?token=${encodeURIComponent(raw)}`).catch((err) =>
    logError("verify-email", "Verification email failed", err),
  );
}

/** For routes that do not go through v1(): the 403 response, or null when the user may proceed. */
export async function unverifiedResponse(userId: string): Promise<NextResponse | null> {
  try {
    await assertVerified(userId);
    return null;
  } catch (e) {
    return toErrorResponse(e);
  }
}
