/**
 * Session token utilities: generation and hashing.
 * Mirrors src/lib/api-key.ts's generate-raw / hash-with-pepper / store-hash-
 * only pattern — the raw token lives only in the client's cookie, never in
 * the database.
 */

import { createId } from "../id";

const TOKEN_LENGTH = 40;

export function generateSessionToken(): string {
  return createId(TOKEN_LENGTH);
}

/**
 * Reads the server-only pepper used to HMAC session tokens. Deliberately has
 * no fallback — same fail-closed convention as API_KEY_PEPPER,
 * INVITE_JWT_SECRET, UNLOCK_TOKEN_SECRET: throws rather than silently hashing
 * (and later verifying) with a guessable or absent secret.
 */
function getPepperKey(): Promise<CryptoKey> {
  const pepper = process.env.SESSION_TOKEN_PEPPER;
  if (!pepper) {
    throw new Error(
      "SESSION_TOKEN_PEPPER is not set. Sessions cannot be hashed or verified without it — set SESSION_TOKEN_PEPPER in the environment (see .env.example).",
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

export async function hashSessionToken(raw: string): Promise<string> {
  const key = await getPepperKey();
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
