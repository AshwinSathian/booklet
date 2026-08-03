import { test, expect } from "@playwright/test";
import { generatePasswordResetToken, hashPasswordResetToken } from "@/lib/auth/password-reset-token";

// Mirrors tests/unit/unlock-token.spec.ts and tests/unit/claim-token.spec.ts
// style — pure generate/hash functions, no DB/server needed.

test.beforeAll(() => {
  process.env.PASSWORD_RESET_TOKEN_PEPPER = "test-only-pepper-do-not-use-in-prod";
});

test.describe("password-reset-token", () => {
  test("throws (fails closed) when PASSWORD_RESET_TOKEN_PEPPER is unset", async () => {
    delete process.env.PASSWORD_RESET_TOKEN_PEPPER;
    await expect(hashPasswordResetToken("some-raw-token")).rejects.toThrow(
      /PASSWORD_RESET_TOKEN_PEPPER/,
    );
    process.env.PASSWORD_RESET_TOKEN_PEPPER = "test-only-pepper-do-not-use-in-prod";
  });

  test("hashing the same raw token twice with the same pepper is deterministic", async () => {
    const a = await hashPasswordResetToken("some-raw-token");
    const b = await hashPasswordResetToken("some-raw-token");
    expect(a).toBe(b);
  });

  test("hashing the same raw token with two different peppers produces different hashes", async () => {
    const a = await hashPasswordResetToken("some-raw-token");
    process.env.PASSWORD_RESET_TOKEN_PEPPER = "a-completely-different-pepper";
    const b = await hashPasswordResetToken("some-raw-token");
    expect(a).not.toBe(b);
    process.env.PASSWORD_RESET_TOKEN_PEPPER = "test-only-pepper-do-not-use-in-prod";
  });

  test("generatePasswordResetToken() produces a 40-character alphanumeric token", async () => {
    const token = generatePasswordResetToken();
    expect(token).toMatch(/^[0-9a-zA-Z]{40}$/);
  });

  test("generatePasswordResetToken() produces distinct tokens on repeated calls", async () => {
    const a = generatePasswordResetToken();
    const b = generatePasswordResetToken();
    expect(a).not.toBe(b);
  });
});
