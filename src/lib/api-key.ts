/**
 * API key utilities: generation and hashing.
 * New keys are prefixed `bklt_` + 40 random chars.
 * Only the HMAC-SHA256 hash is stored in the DB; the raw key is shown once.
 */

import { createId } from "./id";

const PREFIX = "bklt_";

// Keys issued before the Readable -> Booklet rename used this prefix.
// Already-issued `rdbl_` keys must keep validating — there's no migration
// path that reissues live keys out from under existing integrations — so
// isApiKeyFormat accepts both; only generateRawKey moves to the new one.
const LEGACY_PREFIXES = ["rdbl_"] as const;

export function generateRawKey(): string {
  return PREFIX + createId(40);
}

/**
 * Reads the server-only pepper used to HMAC API keys. Deliberately has no
 * fallback — key entropy alone (40 random chars) makes brute-forcing an
 * unsalted hash impractical, but a pepper means the `api_keys.key_hash`
 * column stays useless to an attacker even if the DB is exfiltrated,
 * without also handing them a way to verify guesses. Same fail-closed
 * convention as INVITE_JWT_SECRET / UNLOCK_TOKEN_SECRET (see
 * src/lib/invite-token.ts, src/lib/unlock-token.ts) — throws rather than
 * silently hashing with no pepper.
 */
function getPepperKey(): Promise<CryptoKey> {
  const pepper = process.env.API_KEY_PEPPER;
  if (!pepper) {
    throw new Error(
      "API_KEY_PEPPER is not set. API keys cannot be hashed or verified without it — set API_KEY_PEPPER in the environment (see .env.example).",
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

export async function hashApiKey(raw: string): Promise<string> {
  const key = await getPepperKey();
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isApiKeyFormat(raw: string): boolean {
  if (raw.startsWith(PREFIX) && raw.length === PREFIX.length + 40) return true;
  return LEGACY_PREFIXES.some((p) => raw.startsWith(p) && raw.length === p.length + 40);
}
