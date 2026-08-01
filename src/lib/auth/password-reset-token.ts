/**
 * Password-reset token utilities: generation and hashing. Mirrors
 * src/lib/auth/session-token.ts's generate-raw / hash-with-pepper /
 * store-hash-only pattern — the raw token is only ever emailed once and
 * lives in the `password_reset_tokens` collection as a hash, so a database
 * read alone can never produce a usable reset link. Uses its own dedicated
 * pepper (not a reuse of SESSION_TOKEN_PEPPER) so a leaked reset-token
 * pepper can't also compromise live sessions.
 */

import { createId } from "../id";

const TOKEN_LENGTH = 40;

export function generatePasswordResetToken(): string {
  return createId(TOKEN_LENGTH);
}

function getPepperKey(): Promise<CryptoKey> {
  const pepper = process.env.PASSWORD_RESET_TOKEN_PEPPER;
  if (!pepper) {
    throw new Error(
      "PASSWORD_RESET_TOKEN_PEPPER is not set. Password-reset tokens cannot be hashed or verified without it — set PASSWORD_RESET_TOKEN_PEPPER in the environment (see .env.example).",
    );
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function hashPasswordResetToken(raw: string): Promise<string> {
  const key = await getPepperKey();
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
