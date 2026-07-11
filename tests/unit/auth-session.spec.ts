import { test, expect } from "@playwright/test";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import {
  createSessionRecord,
  deleteAllUserSessions,
  deleteSessionByHash,
  findSessionByHash,
} from "@/lib/db/auth";
import { hashSessionToken } from "@/lib/auth/session-token";

// Requires a real MongoDB connection — see tests/unit/versions-concurrency.spec.ts
// for why (no mocked/in-memory Mongo in this repo).

test.beforeAll(async () => {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017/readable?retryWrites=true&w=majority";
  process.env.SESSION_TOKEN_PEPPER ??= "test-only-pepper-do-not-use-in-prod";

  const db = await getDb();
  await ensureIndexes(db);
});

function futureDate(ms = 30 * 24 * 60 * 60 * 1000): Date {
  return new Date(Date.now() + ms);
}

test.describe("session records", () => {
  test("createSessionRecord + findSessionByHash round-trips", async () => {
    const userId = `test-user-${Date.now()}-a`;
    const tokenHash = await hashSessionToken(`raw-token-${Date.now()}-a`);
    await createSessionRecord(userId, tokenHash, futureDate());

    const found = await findSessionByHash(tokenHash);
    expect(found).not.toBeNull();
    expect(found?.user_id).toBe(userId);
  });

  test("findSessionByHash returns null for an unknown hash", async () => {
    const found = await findSessionByHash("0".repeat(64));
    expect(found).toBeNull();
  });

  test("deleteSessionByHash revokes a single session", async () => {
    const userId = `test-user-${Date.now()}-b`;
    const tokenHash = await hashSessionToken(`raw-token-${Date.now()}-b`);
    await createSessionRecord(userId, tokenHash, futureDate());

    await deleteSessionByHash(tokenHash);
    expect(await findSessionByHash(tokenHash)).toBeNull();
  });

  test("deleteAllUserSessions revokes every session for a user (logout-everywhere)", async () => {
    const userId = `test-user-${Date.now()}-c`;
    const hashA = await hashSessionToken(`raw-token-${Date.now()}-c1`);
    const hashB = await hashSessionToken(`raw-token-${Date.now()}-c2`);
    await createSessionRecord(userId, hashA, futureDate());
    await createSessionRecord(userId, hashB, futureDate());

    await deleteAllUserSessions(userId);

    expect(await findSessionByHash(hashA)).toBeNull();
    expect(await findSessionByHash(hashB)).toBeNull();
  });

  test("token_hash uniqueness is enforced by the index (duplicate insert rejected)", async () => {
    const tokenHash = await hashSessionToken(`raw-token-${Date.now()}-dup`);
    await createSessionRecord(`test-user-${Date.now()}-d1`, tokenHash, futureDate());

    await expect(
      createSessionRecord(`test-user-${Date.now()}-d2`, tokenHash, futureDate()),
    ).rejects.toThrow();
  });
});
