/**
 * Claiming a page that was published without an account.
 *
 * At anonymous publish the server mints a random token, stores only its
 * SHA-256 on the document, and sets the raw token as an httpOnly cookie in
 * the publisher's browser. That cookie is the only proof of authorship an
 * anonymous page has: it is what lets the share page show the expiry notice
 * to its author alone, and what POST /api/pages/:id/claim requires before
 * it hands the page to a signed-in account. Without it, any signed-in user
 * could take ownership of any anonymous page by id.
 *
 * A plain hash (no pepper) is enough: the token is 256 bits of randomness,
 * not a guessable secret.
 */

export { ANONYMOUS_PAGE_TTL_DAYS, PURGE_GRACE_DAYS } from "@/lib/db/expiry.mjs";

export function claimCookieName(pageId: string): string {
  return `booklet_claim_${pageId}`;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateClaimToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashClaimToken(token: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
}

/** Constant-time comparison of a presented token against the stored hash. */
export async function claimTokenMatches(token: string | undefined | null, storedHash: string | null): Promise<boolean> {
  if (!token || !storedHash) return false;
  const presented = await hashClaimToken(token);
  if (presented.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < presented.length; i++) diff |= presented.charCodeAt(i) ^ storedHash.charCodeAt(i);
  return diff === 0;
}
