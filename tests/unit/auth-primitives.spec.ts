import { test, expect } from "@playwright/test";
import { generateSessionToken, hashSessionToken } from "@/lib/auth/session-token";
import { hashUserPassword, verifyUserPassword } from "@/lib/auth/password";

// Session tokens follow the exact same generate-raw/hash-with-pepper pattern
// as API keys (src/lib/api-key.ts, covered by tests/unit/api-key.spec.ts) —
// mirrored coverage here for the session-specific primitive.

test.describe("session token hashing", () => {
  test.beforeEach(() => {
    process.env.SESSION_TOKEN_PEPPER = "test-only-pepper-do-not-use-in-prod";
  });

  test("generated tokens are 40 chars", () => {
    expect(generateSessionToken().length).toBe(40);
  });

  test("two generated tokens differ", () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });

  test("hashSessionToken is deterministic for the same token + pepper", async () => {
    const raw = generateSessionToken();
    const a = await hashSessionToken(raw);
    const b = await hashSessionToken(raw);
    expect(a).toBe(b);
  });

  test("hashSessionToken output is 64 hex chars (HMAC-SHA256)", async () => {
    const hash = await hashSessionToken(generateSessionToken());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a different pepper produces a different hash for the same token", async () => {
    const raw = generateSessionToken();
    const hashA = await hashSessionToken(raw);
    process.env.SESSION_TOKEN_PEPPER = "a-completely-different-pepper";
    const hashB = await hashSessionToken(raw);
    expect(hashA).not.toBe(hashB);
  });

  test("throws (fails closed) when SESSION_TOKEN_PEPPER is unset", async () => {
    delete process.env.SESSION_TOKEN_PEPPER;
    await expect(hashSessionToken("whatever")).rejects.toThrow(/SESSION_TOKEN_PEPPER/);
  });
});

test.describe("user account password hashing (argon2id)", () => {
  test("verifyUserPassword succeeds for the correct password", async () => {
    const hash = await hashUserPassword("correct horse battery staple");
    expect(await verifyUserPassword("correct horse battery staple", hash)).toBe(true);
  });

  test("verifyUserPassword fails for a wrong password", async () => {
    const hash = await hashUserPassword("correct horse battery staple");
    expect(await verifyUserPassword("wrong password", hash)).toBe(false);
  });

  test("verifyUserPassword fails safely (no throw) against a malformed hash", async () => {
    expect(await verifyUserPassword("anything", "not-a-real-hash")).toBe(false);
  });

  test("two hashes of the same password differ (random salt per hash)", async () => {
    const a = await hashUserPassword("same-password");
    const b = await hashUserPassword("same-password");
    expect(a).not.toBe(b);
  });
});
