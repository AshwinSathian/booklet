import { test, expect } from "@playwright/test";
import { generateRawKey, hashApiKey, isApiKeyFormat } from "@/lib/api-key";

// Regression coverage for hardening API-key hashing from unsalted SHA-256
// to a server-pepper-keyed HMAC-SHA256 (src/lib/api-key.ts) — even if the
// api_keys.key_hash column were exfiltrated, an attacker can't verify
// guesses against it without also having API_KEY_PEPPER.

test.describe("api-key hashing", () => {
  test.beforeEach(() => {
    process.env.API_KEY_PEPPER = "test-only-pepper-do-not-use-in-prod";
  });

  test("generated keys have the expected prefix/length and pass isApiKeyFormat", () => {
    const raw = generateRawKey();
    expect(raw.startsWith("rdbl_")).toBe(true);
    expect(raw.length).toBe("rdbl_".length + 40);
    expect(isApiKeyFormat(raw)).toBe(true);
  });

  test("hashApiKey is deterministic for the same key + pepper", async () => {
    const raw = generateRawKey();
    const a = await hashApiKey(raw);
    const b = await hashApiKey(raw);
    expect(a).toBe(b);
  });

  test("hashApiKey output is 64 hex chars (HMAC-SHA256)", async () => {
    const raw = generateRawKey();
    const hash = await hashApiKey(raw);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a different pepper produces a different hash for the same key", async () => {
    const raw = generateRawKey();
    const hashA = await hashApiKey(raw);
    process.env.API_KEY_PEPPER = "a-completely-different-pepper";
    const hashB = await hashApiKey(raw);
    expect(hashA).not.toBe(hashB);
  });

  test("throws (fails closed) when API_KEY_PEPPER is unset", async () => {
    delete process.env.API_KEY_PEPPER;
    await expect(hashApiKey("rdbl_whatever")).rejects.toThrow(/API_KEY_PEPPER/);
  });
});
