import { test, expect } from "@playwright/test";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import {
  getPageReactions,
  incrementReaction,
  addReactionForSession,
  removeReactionForSession,
} from "@/lib/db/reactions";
import { incrementViewCount } from "@/lib/db";

// Regression coverage for two audit findings fixed together:
//
// P0-8: getPageReactions used to build a MongoDB $regex directly from an
// unvalidated pageId route param (`{ _id: { $regex: `^${pageId}:` } }`). A
// crafted pageId containing regex metacharacters/alternation could
// over-match other pages' reaction docs, or cause ReDoS via a pathological
// pattern. Fixed by storing an explicit indexed `page_id` field and
// querying it with equality, never a regex.
//
// P2-8: neither view counts nor reaction counts had any per-visitor
// dedupe — a single visitor could inflate either just by reloading /
// clicking repeatedly. Fixed with a session-hash dedupe (same derivation
// as analytics_events' existing session-scoped dedupe).
//
// These tests require a real MongoDB connection (getDb() talks to a real
// server — no mocked/in-memory Mongo in this repo). They point at the same
// local `mongod` used for local dev (see .env.local), mirroring the pattern
// in tests/unit/versions-concurrency.spec.ts.

test.beforeAll(async () => {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017/readable?retryWrites=true&w=majority";
  const db = await getDb();
  await ensureIndexes(db);
});

async function cleanupPage(pageId: string) {
  const db = await getDb();
  await db.collection("reactions").deleteMany({ page_id: pageId });
  // Old-shape docs (pre-fix) had no page_id field — clean those up by _id prefix too.
  await db.collection("reactions").deleteMany({ _id: { $regex: `^${pageId}:` } } as never);
  await db.collection("reaction_state").deleteMany({ page_id: pageId });
  await db.collection("view_dedupe").deleteMany({ page_id: pageId });
  await db.collection("pages").deleteMany({ _id: pageId } as never);
}

test.describe("getPageReactions — $regex injection fix", () => {
  test("equality match returns correct counts for normal page ids (before/after parity)", async () => {
    const pageA = `testpage${crypto.randomUUID().replace(/-/g, "")}`;
    const pageB = `testpage${crypto.randomUUID().replace(/-/g, "")}`;

    try {
      await incrementReaction(pageA, "👍");
      await incrementReaction(pageA, "👍");
      await incrementReaction(pageA, "🔥");
      await incrementReaction(pageB, "👍");

      const countsA = await getPageReactions(pageA);
      const countsB = await getPageReactions(pageB);

      expect(countsA).toEqual({ "👍": 2, "🔥": 1 });
      expect(countsB).toEqual({ "👍": 1 });
    } finally {
      await cleanupPage(pageA);
      await cleanupPage(pageB);
    }
  });

  test("a crafted regex-metacharacter pageId no longer over-matches other pages' reactions", async () => {
    // Two "victim" pages with real reactions.
    const victim1 = `testvictim1${crypto.randomUUID().replace(/-/g, "")}`;
    const victim2 = `testvictim2${crypto.randomUUID().replace(/-/g, "")}`;

    // An "attacker" pageId that, under the OLD `{ _id: { $regex: `^${pageId}:` } }`
    // implementation, would have been compiled into a regex whose alternation
    // matches both victims' _id prefixes — e.g. `(victim1|victim2)`. Under the
    // fix, pageId is only ever used in an equality match against an indexed
    // page_id field, so this string can only ever match a page literally named
    // this way (which doesn't exist), never victim1/victim2's real reactions.
    const attackerPageId = `(${victim1}|${victim2})`;

    try {
      await incrementReaction(victim1, "👍");
      await incrementReaction(victim2, "🔥");

      const attackerView = await getPageReactions(attackerPageId);
      // Must be empty: no page literally named `(victim1|victim2)` has any
      // reactions, and the old regex-prefix-scan behavior that would have
      // pulled in both victims' docs must no longer happen.
      expect(attackerView).toEqual({});

      // Sanity: the victims' own reactions are unaffected and independently visible.
      expect(await getPageReactions(victim1)).toEqual({ "👍": 1 });
      expect(await getPageReactions(victim2)).toEqual({ "🔥": 1 });
    } finally {
      await cleanupPage(victim1);
      await cleanupPage(victim2);
      await cleanupPage(attackerPageId);
    }
  });

  test("pathological regex-metacharacter pageId (ReDoS shape) resolves instantly and returns empty", async () => {
    const pathological = "(a+)+$".repeat(20); // classic catastrophic-backtracking shape
    const start = Date.now();
    const result = await getPageReactions(pathological);
    const elapsedMs = Date.now() - start;

    // Caught by the defense-in-depth pageId shape check before it ever
    // reaches Mongo (getPageReactions no longer builds a regex out of it at
    // all — this pattern would never even reach a $regex operator now,
    // let alone one built from unescaped user input).
    expect(result).toEqual({});
    expect(elapsedMs).toBeLessThan(2_000);
  });

  test("incrementReaction/decrementReaction backfill page_id/emoji via $set on both insert and existing docs", async () => {
    const pageId = `testbackfill${crypto.randomUUID().replace(/-/g, "")}`;
    try {
      await incrementReaction(pageId, "💡");
      const db = await getDb();
      const doc = await db.collection("reactions").findOne({ _id: `${pageId}:💡` } as never);
      expect(doc?.page_id).toBe(pageId);
      expect(doc?.emoji).toBe("💡");
      expect(doc?.count).toBe(1);

      // Incrementing again ($set alongside $inc) must keep page_id/emoji
      // consistent, not just set them once on insert.
      await incrementReaction(pageId, "💡");
      const doc2 = await db.collection("reactions").findOne({ _id: `${pageId}:💡` } as never);
      expect(doc2?.page_id).toBe(pageId);
      expect(doc2?.count).toBe(2);
    } finally {
      await cleanupPage(pageId);
    }
  });
});

test.describe("reaction toggle dedupe (addReactionForSession / removeReactionForSession)", () => {
  test("repeated 'add' clicks from the same session only count once", async () => {
    const pageId = `testdedupeadd${crypto.randomUUID().replace(/-/g, "")}`;
    const sessionA = `session-a-${crypto.randomUUID()}`;

    try {
      const c1 = await addReactionForSession(pageId, "👍", sessionA);
      const c2 = await addReactionForSession(pageId, "👍", sessionA);
      const c3 = await addReactionForSession(pageId, "👍", sessionA);

      expect(c1).toBe(1);
      expect(c2).toBe(1); // no-op, not 2
      expect(c3).toBe(1); // no-op, not 3

      expect(await getPageReactions(pageId)).toEqual({ "👍": 1 });
    } finally {
      await cleanupPage(pageId);
    }
  });

  test("different sessions each count independently", async () => {
    const pageId = `testdedupemulti${crypto.randomUUID().replace(/-/g, "")}`;
    const sessionA = `session-a-${crypto.randomUUID()}`;
    const sessionB = `session-b-${crypto.randomUUID()}`;

    try {
      await addReactionForSession(pageId, "👍", sessionA);
      await addReactionForSession(pageId, "👍", sessionB);
      // sessionA clicks again — still a no-op.
      await addReactionForSession(pageId, "👍", sessionA);

      expect(await getPageReactions(pageId)).toEqual({ "👍": 2 });
    } finally {
      await cleanupPage(pageId);
    }
  });

  test("toggle off then back on works: add -> remove -> add", async () => {
    const pageId = `testtoggle${crypto.randomUUID().replace(/-/g, "")}`;
    const sessionA = `session-a-${crypto.randomUUID()}`;

    try {
      expect(await addReactionForSession(pageId, "🔥", sessionA)).toBe(1);
      expect(await removeReactionForSession(pageId, "🔥", sessionA)).toBe(0);
      expect(await addReactionForSession(pageId, "🔥", sessionA)).toBe(1);

      expect(await getPageReactions(pageId)).toEqual({ "🔥": 1 });
    } finally {
      await cleanupPage(pageId);
    }
  });

  test("a session spamming 'remove' without ever adding cannot decrement another session's reaction", async () => {
    const pageId = `testgriefing${crypto.randomUUID().replace(/-/g, "")}`;
    const victimSession = `victim-${crypto.randomUUID()}`;
    const attackerSession = `attacker-${crypto.randomUUID()}`;

    try {
      await addReactionForSession(pageId, "❤️", victimSession);
      expect(await getPageReactions(pageId)).toEqual({ "❤️": 1 });

      // Attacker never added — repeated "remove" must be a no-op every time.
      for (let i = 0; i < 5; i++) {
        const count = await removeReactionForSession(pageId, "❤️", attackerSession);
        expect(count).toBe(1);
      }

      expect(await getPageReactions(pageId)).toEqual({ "❤️": 1 });
    } finally {
      await cleanupPage(pageId);
    }
  });
});

test.describe("incrementViewCount — per-session dedupe", () => {
  test("repeated views from the same session only count once; a different session still counts", async () => {
    const db = await getDb();
    const pageId = `testview${crypto.randomUUID().replace(/-/g, "")}`;
    const sessionA = `view-session-a-${crypto.randomUUID()}`;
    const sessionB = `view-session-b-${crypto.randomUUID()}`;

    try {
      await db.collection("pages").insertOne({ _id: pageId, view_count: 0 } as never);

      await incrementViewCount(pageId, sessionA);
      await incrementViewCount(pageId, sessionA); // reload from the same visitor — no-op
      await incrementViewCount(pageId, sessionA); // another reload — still no-op

      let page = await db.collection("pages").findOne({ _id: pageId } as never);
      expect(page?.view_count).toBe(1);

      // A genuinely different visitor (different session hash) still counts.
      await incrementViewCount(pageId, sessionB);

      page = await db.collection("pages").findOne({ _id: pageId } as never);
      expect(page?.view_count).toBe(2);
    } finally {
      await cleanupPage(pageId);
    }
  });
});
