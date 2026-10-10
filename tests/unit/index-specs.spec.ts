import { test, expect } from "@playwright/test";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { useTestEnv } from "./helpers/pages";

// ensureIndexes on a database whose index was built with older options: the
// index is rebuilt, not left as it was. A database of its own, so the indexes
// the other specs rely on are never dropped under them.

const SCRATCH = `booklet_index_specs_${Date.now()}`;

test.beforeAll(() => {
  useTestEnv();
});

test.afterAll(async () => {
  await (await getDb()).client.db(SCRATCH).dropDatabase();
});

test("an index whose options changed is rebuilt with the current ones", async () => {
  const db = (await getDb()).client.db(SCRATCH);
  // users.email as it was before 2.0.0: unique and sparse.
  await db.collection("users").createIndex({ email: 1 }, { unique: true, sparse: true });

  await ensureIndexes(db);

  const email = (await db.collection("users").indexes()).find((i) => i.name === "email_1");
  expect(email?.unique).toBe(true);
  expect(email?.sparse).toBeUndefined();
  // And a second run is a no-op.
  await ensureIndexes(db);
});
