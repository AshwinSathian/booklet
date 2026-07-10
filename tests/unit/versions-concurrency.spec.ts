import { test, expect } from "@playwright/test";
import type { PublishedDoc } from "@/lib/blocks";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { snapshotPageVersion, getPageVersions, deletePageVersions } from "@/lib/db/versions";

// Regression coverage for the audit finding fixed alongside this suite:
//   snapshotPageVersion used to read the current max version_number and
//   insertOne the next number as two separate steps, with no unique index
//   backing (page_id, version_number). Two concurrent snapshots for the
//   same page (e.g. an autosave racing a CLI publish, or two collaborators)
//   could both read the same "latest" and both insert the same
//   version_number, corrupting restore ordering.
//
// This test requires a real MongoDB connection (getDb() in
// src/lib/mongodb.ts talks to a real server — there is no mocked/in-memory
// Mongo in this repo). It points at the same local `mongod` instance used
// for local dev (see .env.local), and ensures the fix's supporting unique
// index actually exists via the same ensureIndexes() the app calls
// automatically at startup (src/instrumentation.ts / src/lib/db/index-specs.mjs)
// — without that index, insertOne would never throw 11000 and the retry
// loop below would never trigger, silently reproducing the original bug.

test.beforeAll(async () => {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017/readable?retryWrites=true&w=majority";

  const db = await getDb();
  await ensureIndexes(db);
});

function makeDoc(n: number): PublishedDoc {
  return {
    v: 1,
    createdAt: new Date().toISOString(),
    settings: { spacing: "comfortable", width: "normal", code: "collapse" },
    blocks: [{ t: "paragraph", inl: [{ t: "text", text: `concurrency attempt ${n}` }] }] as unknown as PublishedDoc["blocks"],
  };
}

test.describe("snapshotPageVersion concurrency", () => {
  test("realistic concurrency (a few simultaneous writers) always produces unique, gapless version numbers", async () => {
    // Mirrors the finding's own scenario: "autosave + a CLI publish, or two
    // collaborators" — a handful of genuinely simultaneous writers, not a
    // pathological thundering herd. This is the case the retry-on-conflict
    // loop (MAX_SNAPSHOT_RETRIES = 5 in src/lib/db/versions.ts) is designed
    // to always resolve without any writer exhausting its retry budget.
    const pageId = `test-concurrency-${crypto.randomUUID()}`;
    const CONCURRENCY = 4;

    try {
      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENCY }, (_, i) => snapshotPageVersion(pageId, makeDoc(i))),
      );

      const failures = results.filter((r) => r.status === "rejected");
      expect(
        failures,
        `unexpected failures: ${failures.map((f) => String((f as PromiseRejectedResult).reason)).join("; ")}`,
      ).toHaveLength(0);

      const versions = await getPageVersions(pageId);
      expect(versions).toHaveLength(CONCURRENCY);

      const numbers = versions.map((v) => v.version_number).sort((a, b) => a - b);
      // No duplicates — this is the actual bug being regression-tested:
      // without the unique index + retry loop, concurrent writers could
      // both land on the same version_number.
      expect(new Set(numbers).size).toBe(CONCURRENCY);
      // No gaps: exactly 1..CONCURRENCY.
      expect(numbers).toEqual(Array.from({ length: CONCURRENCY }, (_, i) => i + 1));
    } finally {
      await deletePageVersions(pageId);
    }
  });

  test("under contention far beyond the retry budget, every write is still either a clean success or the documented bounded error — never silent corruption, never a hang", async () => {
    // This deliberately exceeds what MAX_SNAPSHOT_RETRIES (5) can guarantee:
    // firing far more fully-simultaneous cold-start writers than the
    // "autosave + publish" scenario the retry count is sized for. Some
    // writers are expected to exhaust their retry budget here — that is the
    // correct, designed behavior ("a clear thrown error after N retries is
    // correct" per the fix's own spec), not a bug. What must never happen:
    // (a) the call hangs indefinitely, (b) a write "succeeds" into a
    // duplicate/gapped version_number, or (c) a write fails with anything
    // other than the documented exhaustion error.
    const pageId = `test-concurrency-burst-${crypto.randomUUID()}`;
    const CONCURRENCY = 20;

    try {
      const start = Date.now();
      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENCY }, (_, i) => snapshotPageVersion(pageId, makeDoc(i))),
      );
      const elapsedMs = Date.now() - start;

      // Never hangs: bounded retries complete promptly rather than spinning.
      expect(elapsedMs).toBeLessThan(30_000);

      const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      // Every failure must be the documented, bounded exhaustion error —
      // never some other unexpected error shape.
      for (const failure of failures) {
        expect(String(failure.reason)).toMatch(
          /snapshotPageVersion: exhausted 5 retries for page/,
        );
      }

      // Whatever DID get written must still be internally consistent: no
      // duplicate or gapped version numbers among the successful writes.
      const versions = await getPageVersions(pageId);
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      expect(versions).toHaveLength(succeeded);

      const numbers = versions.map((v) => v.version_number).sort((a, b) => a - b);
      expect(new Set(numbers).size).toBe(numbers.length); // no duplicates
      expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => i + 1)); // no gaps
    } finally {
      await deletePageVersions(pageId);
    }
  });
});
