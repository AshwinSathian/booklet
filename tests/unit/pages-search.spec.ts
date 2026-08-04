import { test, expect } from "@playwright/test";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { createPageRecord, getPagesByUser } from "@/lib/db";

// Coverage for the agent-native search capability added to make Booklet's
// CLI/API/MCP surface useful to an agent managing many pages: getPagesByUser
// gained optional `query` (case-insensitive substring on title) and `tag`
// (exact match on frontmatter_meta.tags) filters. Omitting both must be
// byte-identical to the pre-existing limit/offset-only behavior — every
// existing caller (My Pages dashboard, CLI `pages list`, current MCP
// `list_pages` calls) relies on that.

test.beforeAll(async () => {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017/readable?retryWrites=true&w=majority";
  const db = await getDb();
  await ensureIndexes(db);
});

function testId(): string {
  return `testsrch${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

async function cleanup(userId: string, pageIds: string[]) {
  const db = await getDb();
  await db.collection("pages").deleteMany({ _id: { $in: pageIds } } as never);
}

test.describe("getPagesByUser — query/tag filtering", () => {
  test("query matches a title substring case-insensitively", async () => {
    const userId = `testuser${crypto.randomUUID()}`;
    const a = testId();
    const b = testId();
    try {
      await createPageRecord(a, userId, "Q4 Release Notes");
      await createPageRecord(b, userId, "Incident Postmortem");

      const { pages, total } = await getPagesByUser(userId, { query: "release" });

      expect(total).toBe(1);
      expect(pages).toHaveLength(1);
      expect(pages[0]?.id).toBe(a);
    } finally {
      await cleanup(userId, [a, b]);
    }
  });

  test("tag matches exactly against frontmatter_meta.tags", async () => {
    const userId = `testuser${crypto.randomUUID()}`;
    const a = testId();
    const b = testId();
    try {
      await createPageRecord(a, userId, "Runbook", null, { tags: ["ops", "runbook"] });
      await createPageRecord(b, userId, "ADR", null, { tags: ["architecture"] });

      const { pages, total } = await getPagesByUser(userId, { tag: "ops" });

      expect(total).toBe(1);
      expect(pages[0]?.id).toBe(a);
    } finally {
      await cleanup(userId, [a, b]);
    }
  });

  test("query and tag combine as AND, not OR", async () => {
    const userId = `testuser${crypto.randomUUID()}`;
    const a = testId();
    const b = testId();
    try {
      await createPageRecord(a, userId, "Release Notes v2", null, { tags: ["release"] });
      await createPageRecord(b, userId, "Release Notes v1", null, { tags: ["archived"] });

      const { pages, total } = await getPagesByUser(userId, { query: "release notes", tag: "release" });

      expect(total).toBe(1);
      expect(pages[0]?.id).toBe(a);
    } finally {
      await cleanup(userId, [a, b]);
    }
  });

  test("a query with no match returns an empty result, not an error", async () => {
    const userId = `testuser${crypto.randomUUID()}`;
    const a = testId();
    try {
      await createPageRecord(a, userId, "Runbook");

      const { pages, total } = await getPagesByUser(userId, { query: "nonexistent-xyz" });

      expect(total).toBe(0);
      expect(pages).toHaveLength(0);
    } finally {
      await cleanup(userId, [a]);
    }
  });

  test("regex metacharacters in query are treated literally, not as a pattern", async () => {
    const userId = `testuser${crypto.randomUUID()}`;
    const a = testId();
    try {
      await createPageRecord(a, userId, "Cost: $5.00 (was $50)");

      // If unescaped, `.` would match any char and `(`/`)` would be an
      // invalid/unintended regex group — this must still match literally.
      const { pages, total } = await getPagesByUser(userId, { query: "$5.00 (was" });

      expect(total).toBe(1);
      expect(pages[0]?.id).toBe(a);
    } finally {
      await cleanup(userId, [a]);
    }
  });

  test("a query longer than the 200-char cap is truncated, not left unbounded", async () => {
    const userId = `testuser${crypto.randomUUID()}`;
    const a = testId();
    try {
      // 250 chars: the first 200 are "A", the rest "Z" — bypasses the
      // normal 64-char title clamp (createPageRecord writes it directly)
      // so a query can meaningfully exceed the 200-char cap in this test.
      const title = "A".repeat(200) + "Z".repeat(50);
      await createPageRecord(a, userId, title);

      // If the query were used unbounded, this 5000-char string could never
      // match a 250-char title (a substring can't be longer than its
      // source) — so a match here only happens if the query was truncated
      // to its first 200 chars ("A" x200, which the title does contain).
      const oversized = "A".repeat(200) + "B".repeat(4800);
      const { pages, total } = await getPagesByUser(userId, { query: oversized });

      expect(total).toBe(1);
      expect(pages[0]?.id).toBe(a);
    } finally {
      await cleanup(userId, [a]);
    }
  });

  test("omitting query and tag returns identical results to today's behavior", async () => {
    const userId = `testuser${crypto.randomUUID()}`;
    const a = testId();
    const b = testId();
    try {
      await createPageRecord(a, userId, "First");
      await createPageRecord(b, userId, "Second");

      const withNoFilters = await getPagesByUser(userId, {});
      const withUndefinedFilters = await getPagesByUser(userId, { query: undefined, tag: undefined });

      expect(withNoFilters.total).toBe(2);
      expect(withUndefinedFilters.total).toBe(2);
      expect(withNoFilters.pages.map((p) => p.id).sort()).toEqual(withUndefinedFilters.pages.map((p) => p.id).sort());
    } finally {
      await cleanup(userId, [a, b]);
    }
  });

  test("a whitespace-only query is treated as no filter", async () => {
    const userId = `testuser${crypto.randomUUID()}`;
    const a = testId();
    try {
      await createPageRecord(a, userId, "Anything");

      const { total } = await getPagesByUser(userId, { query: "   " });

      expect(total).toBe(1);
    } finally {
      await cleanup(userId, [a]);
    }
  });
});
