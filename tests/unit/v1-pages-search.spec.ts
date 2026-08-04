import { test, expect } from "@playwright/test";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { createApiKey, createPageRecord } from "@/lib/db";
import { generateRawKey, hashApiKey } from "@/lib/api-key";
import { createId } from "@/lib/id";
import { GET } from "@/app/api/v1/pages/route";

// Route-level coverage for the `?q=`/`?tag=` params added to GET
// /api/v1/pages — this is the surface an MCP agent's list_pages tool and
// booklet-cli's `pages list` both call through packages/shared. Exercised
// through the real resolveApiKey() auth path (a real hashed key record),
// not a mocked session, since that's the actual auth boundary this route
// enforces.

test.beforeAll(async () => {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017/readable?retryWrites=true&w=majority";
  process.env.API_KEY_PEPPER ??= "test-only-pepper-do-not-use-in-prod";
  const db = await getDb();
  await ensureIndexes(db);
});

async function seedUserWithKey() {
  const userId = `testuser${crypto.randomUUID()}`;
  const keyId = createId(10);
  const raw = generateRawKey();
  const keyHash = await hashApiKey(raw);
  await createApiKey(keyId, userId, keyHash, "test key");
  return { userId, keyId, rawKey: raw };
}

async function cleanup(userId: string, keyId: string, pageIds: string[]) {
  const db = await getDb();
  await db.collection("api_keys").deleteOne({ _id: keyId } as never);
  await db.collection("pages").deleteMany({ _id: { $in: pageIds } } as never);
}

function listRequest(rawKey: string, qs: string) {
  return new Request(`http://localhost/api/v1/pages${qs}`, {
    headers: { authorization: `Bearer ${rawKey}` },
  });
}

test.describe("GET /api/v1/pages — ?q=/?tag= filtering", () => {
  test("no query params returns every page, unchanged from pre-filter behavior", async () => {
    const { userId, keyId, rawKey } = await seedUserWithKey();
    const a = createId(10);
    const b = createId(10);
    try {
      await createPageRecord(a, userId, "Alpha");
      await createPageRecord(b, userId, "Beta");

      const res = await GET(listRequest(rawKey, ""));
      const body = (await res.json()) as { pages: Array<{ id: string }>; total: number };

      expect(res.status).toBe(200);
      expect(body.total).toBe(2);
      expect(body.pages.map((p) => p.id).sort()).toEqual([a, b].sort());
    } finally {
      await cleanup(userId, keyId, [a, b]);
    }
  });

  test("?q= narrows results to a title substring match", async () => {
    const { userId, keyId, rawKey } = await seedUserWithKey();
    const a = createId(10);
    const b = createId(10);
    try {
      await createPageRecord(a, userId, "Release Notes 2.5");
      await createPageRecord(b, userId, "Incident Report");

      const res = await GET(listRequest(rawKey, "?q=release"));
      const body = (await res.json()) as { pages: Array<{ id: string }>; total: number };

      expect(body.total).toBe(1);
      expect(body.pages[0]?.id).toBe(a);
    } finally {
      await cleanup(userId, keyId, [a, b]);
    }
  });

  test("?tag= narrows results to an exact frontmatter tag match", async () => {
    const { userId, keyId, rawKey } = await seedUserWithKey();
    const a = createId(10);
    const b = createId(10);
    try {
      await createPageRecord(a, userId, "Runbook", null, { tags: ["ops"] });
      await createPageRecord(b, userId, "ADR", null, { tags: ["architecture"] });

      const res = await GET(listRequest(rawKey, "?tag=ops"));
      const body = (await res.json()) as { pages: Array<{ id: string }>; total: number };

      expect(body.total).toBe(1);
      expect(body.pages[0]?.id).toBe(a);
    } finally {
      await cleanup(userId, keyId, [a, b]);
    }
  });

  test("an empty ?q= behaves as no filter, not a zero-result filter", async () => {
    const { userId, keyId, rawKey } = await seedUserWithKey();
    const a = createId(10);
    try {
      await createPageRecord(a, userId, "Anything");

      const res = await GET(listRequest(rawKey, "?q="));
      const body = (await res.json()) as { total: number };

      expect(body.total).toBe(1);
    } finally {
      await cleanup(userId, keyId, [a]);
    }
  });

  test("q and tag together apply as AND", async () => {
    const { userId, keyId, rawKey } = await seedUserWithKey();
    const a = createId(10);
    const b = createId(10);
    try {
      await createPageRecord(a, userId, "Release Notes v2", null, { tags: ["release"] });
      await createPageRecord(b, userId, "Release Notes v1", null, { tags: ["archived"] });

      const res = await GET(listRequest(rawKey, "?q=release%20notes&tag=release"));
      const body = (await res.json()) as { pages: Array<{ id: string }>; total: number };

      expect(body.total).toBe(1);
      expect(body.pages[0]?.id).toBe(a);
    } finally {
      await cleanup(userId, keyId, [a, b]);
    }
  });
});
