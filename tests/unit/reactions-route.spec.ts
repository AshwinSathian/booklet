import { test, expect } from "@playwright/test";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { putDoc, deleteDoc } from "@/lib/storage";
import { createPageRecord } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { POST } from "@/app/api/reactions/[pageId]/route";

// Regression coverage for the "anonymous pages get zero virality loop" fix:
// the reactions POST handler used to 404 whenever no `pages` record existed
// for the target id — which is *always* true for anonymous publishes (see
// api/publish/route.ts, which only calls createPageRecord when
// isAuthenticated). That meant the reaction buttons rendered (once the
// page.tsx gating was fixed) but every click silently failed. Fixed by
// treating "doc exists in storage" as the existence check, and reserving
// the 404 for genuinely password-locked pages.

test.beforeAll(async () => {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017/readable?retryWrites=true&w=majority";
  const db = await getDb();
  await ensureIndexes(db);
});

async function cleanup(pageId: string) {
  const db = await getDb();
  await db.collection("reactions").deleteMany({ page_id: pageId });
  await db.collection("reaction_state").deleteMany({ page_id: pageId });
  await db.collection("pages").deleteMany({ _id: pageId } as never);
  await deleteDoc(pageId);
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/reactions/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test.describe("POST /api/reactions/[pageId] — anonymous pages", () => {
  test("a page published anonymously (no pages record) accepts reactions instead of 404ing", async () => {
    const pageId = `testanon${crypto.randomUUID().replace(/-/g, "")}`;
    try {
      await putDoc(pageId, {
        v: 1,
        createdAt: new Date().toISOString(),
        settings: DEFAULT_SETTINGS,
        blocks: [],
        raw: "# hi",
      } as never);

      const res = await POST(postRequest({ emoji: "👍", action: "add" }), {
        params: Promise.resolve({ pageId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.count).toBe(1);
    } finally {
      await cleanup(pageId);
    }
  });

  test("a nonexistent pageId (no doc, no record) still 404s", async () => {
    const pageId = `testmissing${crypto.randomUUID().replace(/-/g, "")}`;
    const res = await POST(postRequest({ emoji: "👍", action: "add" }), {
      params: Promise.resolve({ pageId }),
    });
    expect(res.status).toBe(404);
  });

  test("a password-locked page still 404s even though a doc exists", async () => {
    const pageId = `testlocked${crypto.randomUUID().replace(/-/g, "")}`;
    try {
      await putDoc(pageId, {
        v: 1,
        createdAt: new Date().toISOString(),
        settings: DEFAULT_SETTINGS,
        blocks: [],
        raw: "# hi",
      } as never);
      await createPageRecord(pageId, `testuser${crypto.randomUUID()}`, null);
      const db = await getDb();
      await db.collection("pages").updateOne(
        { _id: pageId } as never,
        { $set: { password_hash: "not-a-real-hash" } },
      );

      const res = await POST(postRequest({ emoji: "👍", action: "add" }), {
        params: Promise.resolve({ pageId }),
      });
      expect(res.status).toBe(404);
    } finally {
      await cleanup(pageId);
    }
  });

  test("a normal owned public page still accepts reactions (pre-existing behavior preserved)", async () => {
    const pageId = `testowned${crypto.randomUUID().replace(/-/g, "")}`;
    try {
      await putDoc(pageId, {
        v: 1,
        createdAt: new Date().toISOString(),
        settings: DEFAULT_SETTINGS,
        blocks: [],
        raw: "# hi",
      } as never);
      await createPageRecord(pageId, `testuser${crypto.randomUUID()}`, null);

      const res = await POST(postRequest({ emoji: "🔥", action: "add" }), {
        params: Promise.resolve({ pageId }),
      });
      expect(res.status).toBe(200);
    } finally {
      await cleanup(pageId);
    }
  });
});
