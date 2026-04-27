/**
 * API key utilities: generation and hashing.
 * Keys are prefixed `rdbl_` + 40 random chars.
 * Only the SHA-256 hash is stored in D1; the raw key is shown once.
 */

import { createId } from "./id";

const PREFIX = "rdbl_";

export function generateRawKey(): string {
  return PREFIX + createId(40);
}

export async function hashApiKey(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isApiKeyFormat(raw: string): boolean {
  return raw.startsWith(PREFIX) && raw.length === PREFIX.length + 40;
}
