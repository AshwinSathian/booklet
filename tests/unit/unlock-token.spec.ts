import { test, expect } from "@playwright/test";
import { signUnlockToken, verifyUnlockToken } from "@/lib/unlock-token";

// Regression coverage for the audit finding fixed alongside this suite:
//   the booklet_unlock_<pageId> cookie used to be the literal string "1" —
//   unsigned, not derived from anything secret. httpOnly stopped page JS
//   from reading it but did nothing to stop an attacker from setting it
//   directly via a raw request. Live-confirmed:
//     curl -H "Cookie: booklet_unlock_<id>=1" /p/<id>
//   returned the full protected body with no password ever entered.
//
// These tests exercise the pure signing/verification functions directly
// (no DB/server needed) — see src/lib/unlock-token.ts.

test.beforeAll(() => {
  // A real secret so signUnlockToken/verifyUnlockToken don't fail closed
  // on missing config while under test.
  process.env.UNLOCK_TOKEN_SECRET = "test-only-secret-do-not-use-in-prod";
});

test.describe("unlock-token", () => {
  test("the literal string \"1\" (the old cookie format) never verifies", async () => {
    const ok = await verifyUnlockToken("page123", "salt:hash", "1");
    expect(ok).toBe(false);
  });

  test("a correctly signed token verifies against the same pageId + password_hash", async () => {
    const token = await signUnlockToken("page123", "salt:hash");
    const ok = await verifyUnlockToken("page123", "salt:hash", token);
    expect(ok).toBe(true);
  });

  test("a token signed for a different page does not verify", async () => {
    const token = await signUnlockToken("page123", "salt:hash");
    const ok = await verifyUnlockToken("otherPage", "salt:hash", token);
    expect(ok).toBe(false);
  });

  test("a token becomes invalid once the page's password_hash changes", async () => {
    // Free invalidation property: rotating the password changes
    // password_hash, so every previously-issued token for the page stops
    // verifying — no separate revocation bookkeeping required.
    const token = await signUnlockToken("page123", "salt:oldhash");
    const ok = await verifyUnlockToken("page123", "salt:newhash", token);
    expect(ok).toBe(false);
  });

  test("missing, empty, or garbage cookie values never verify", async () => {
    expect(await verifyUnlockToken("page123", "salt:hash", undefined)).toBe(false);
    expect(await verifyUnlockToken("page123", "salt:hash", null)).toBe(false);
    expect(await verifyUnlockToken("page123", "salt:hash", "")).toBe(false);
    expect(await verifyUnlockToken("page123", "salt:hash", "not-a-real-token")).toBe(false);
  });

  test("tokens are hex-encoded HMAC-SHA256 output (64 hex chars)", async () => {
    const token = await signUnlockToken("page123", "salt:hash");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});
