import { test, expect } from "@playwright/test";
import { signClaimToken, verifyClaimToken } from "@/lib/auth/claim-token";

// Mirrors tests/unit/unlock-token.spec.ts and tests/unit/versions-concurrency.spec.ts
// style — pure sign/verify functions, no DB/server needed.

test.beforeAll(() => {
  process.env.CLAIM_TOKEN_SECRET = "test-only-secret-do-not-use-in-prod";
});

test.describe("claim-token", () => {
  test("a correctly signed token verifies and returns the same userId", async () => {
    const token = await signClaimToken({ userId: "user_abc123" });
    const payload = await verifyClaimToken(token);
    expect(payload.userId).toBe("user_abc123");
  });

  test("throws (fails closed) when CLAIM_TOKEN_SECRET is unset", async () => {
    delete process.env.CLAIM_TOKEN_SECRET;
    await expect(signClaimToken({ userId: "user_abc123" })).rejects.toThrow(/CLAIM_TOKEN_SECRET/);
    process.env.CLAIM_TOKEN_SECRET = "test-only-secret-do-not-use-in-prod";
  });

  test("a token signed with a different secret does not verify", async () => {
    const token = await signClaimToken({ userId: "user_abc123" });
    process.env.CLAIM_TOKEN_SECRET = "a-completely-different-secret";
    await expect(verifyClaimToken(token)).rejects.toThrow();
    process.env.CLAIM_TOKEN_SECRET = "test-only-secret-do-not-use-in-prod";
  });

  test("garbage tokens never verify", async () => {
    await expect(verifyClaimToken("not-a-real-token")).rejects.toThrow();
    await expect(verifyClaimToken("")).rejects.toThrow();
  });
});
