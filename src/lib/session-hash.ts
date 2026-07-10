/**
 * Derives an anonymous, per-day, per-visitor "session hash" from client IP +
 * user agent — the same dedupe key analytics_events has used since it
 * introduced its `{ session_hash, page_id, event }` unique index (see
 * src/lib/db/index-specs.mjs). Extracted here so every feature that needs
 * "same visitor, same day" dedupe (analytics events, view-count increments,
 * reaction toggle state) derives it identically instead of re-implementing
 * (and risking drift from) the hash formula.
 *
 * Not a persistent identity: it rotates daily by design (the date is baked
 * into the digest) and is one-way (SHA-256 — the IP/UA are never stored in
 * cleartext). This bounds how much a single visitor can inflate a counter
 * per page *per day*, not for all time; that's an intentional trade-off
 * matching the existing analytics dedupe, not an oversight.
 */
export async function hashSession(ip: string, userAgent: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${ip}|${userAgent}|${today}`),
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
