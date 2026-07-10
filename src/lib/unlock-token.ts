const HMAC_ALGO = { name: "HMAC", hash: "SHA-256" };

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Reads the dedicated unlock-token signing secret. Deliberately has no
 * fallback — if UNLOCK_TOKEN_SECRET is unset, unlock tokens must not be
 * signed or verified with any other value (a hardcoded constant would be
 * readable from source; borrowing CLERK_SECRET_KEY or INVITE_JWT_SECRET
 * would needlessly couple unrelated systems). Throws so misconfiguration
 * fails loudly instead of silently trusting a guessable secret — mirrors
 * getJwtSecret() in src/lib/invite-token.ts.
 */
function getUnlockTokenSecret(): Uint8Array<ArrayBuffer> {
  const secret = process.env.UNLOCK_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "UNLOCK_TOKEN_SECRET is not set. Password-unlock tokens cannot be signed or verified without it — set UNLOCK_TOKEN_SECRET in the environment (see .env.example).",
    );
  }
  return new TextEncoder().encode(secret);
}

async function computeToken(pageId: string, passwordHash: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    getUnlockTokenSecret(),
    HMAC_ALGO,
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    HMAC_ALGO,
    key,
    new TextEncoder().encode(`${pageId}:${passwordHash}`),
  );
  return bufToHex(sig);
}

/**
 * Signs an unlock token for `pageId`, tying it to the page's *current*
 * password_hash. Binding to password_hash (rather than just pageId) means:
 *   (a) the token can't be computed without knowing both the server secret
 *       AND the current password hash, and
 *   (b) if the owner ever changes the page's password, password_hash
 *       changes and every previously-issued unlock token for that page
 *       automatically stops validating — free invalidation on password
 *       rotation, with no separate revocation bookkeeping needed.
 *
 * Throws if UNLOCK_TOKEN_SECRET is unset (fail closed on misconfiguration).
 */
export async function signUnlockToken(pageId: string, passwordHash: string): Promise<string> {
  return computeToken(pageId, passwordHash);
}

/**
 * Verifies an unlock token against the page's current password_hash.
 * Returns false (never throws) for a missing, malformed, or stale-format
 * token — e.g. the old unlock cookie's literal `"1"` value — so a pre-fix
 * cookie simply re-prompts for the password instead of crashing the page.
 * Uses a constant-time comparison, mirroring verifyPassword() in
 * src/lib/password.ts.
 */
export async function verifyUnlockToken(
  pageId: string,
  passwordHash: string,
  token: string | null | undefined,
): Promise<boolean> {
  if (!token || typeof token !== "string") return false;

  const expected = await computeToken(pageId, passwordHash);

  // Constant-time compare — avoid a length-dependent early return leaking
  // timing information, and never use `===` on secret-derived strings.
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}
