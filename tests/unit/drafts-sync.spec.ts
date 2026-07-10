import { test, expect } from "@playwright/test";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import {
  deleteDraftRecord,
  getDraftRecord,
  getDraftsByUser,
  upsertDraftRecord,
} from "@/lib/db/drafts";
import { decideDraftSyncDirection } from "@/lib/drafts/cloud-sync";
import type { DraftDoc } from "@/lib/drafts/types";

// Coverage for P4-2 (cloud draft sync, see AUDIT_REMEDIATION_PLAN.md):
//   - src/lib/db/drafts.ts, the server-side CRUD for the new `drafts`
//     collection (modeled on pages' CRUD in src/lib/db/index.ts).
//   - decideDraftSyncDirection, the pure last-write-wins reconciliation
//     rule used by src/lib/drafts/cloud-sync.ts's pullCloudDrafts().
//
// The db/drafts.ts tests require a real MongoDB connection (getDb() talks
// to a real server — no mocked/in-memory Mongo in this repo). Same local
// `mongod` + ensureIndexes bootstrap pattern as tests/unit/reactions.spec.ts
// and tests/unit/versions-concurrency.spec.ts.

test.beforeAll(async () => {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017/readable?retryWrites=true&w=majority";
  const db = await getDb();
  await ensureIndexes(db);
});

function makeDraft(overrides: Partial<DraftDoc> = {}): DraftDoc {
  const now = new Date().toISOString();
  return {
    id: `test-draft-${crypto.randomUUID()}`,
    v: 2,
    createdAt: now,
    updatedAt: now,
    title: "Untitled",
    raw: "# hello",
    settings: { spacing: "comfortable", width: "normal", code: "collapse" },
    ...overrides,
  };
}

async function cleanupDraft(id: string) {
  const db = await getDb();
  await db.collection("drafts").deleteOne({ _id: id } as never);
}

test.describe("src/lib/db/drafts.ts — cloud draft CRUD", () => {
  test("upsertDraftRecord creates a draft retrievable by getDraftRecord, with user_id attached", async () => {
    const userId = `test-user-${crypto.randomUUID()}`;
    const draft = makeDraft({ title: "My first cloud draft" });

    try {
      await upsertDraftRecord(draft.id, userId, draft);

      const record = await getDraftRecord(draft.id);
      expect(record).not.toBeNull();
      expect(record?.user_id).toBe(userId);
      expect(record?.title).toBe("My first cloud draft");
      expect(record?.raw).toBe(draft.raw);
      expect(record?.settings).toEqual(draft.settings);
    } finally {
      await cleanupDraft(draft.id);
    }
  });

  test("upsertDraftRecord updates an existing draft in place (same id, new content)", async () => {
    const userId = `test-user-${crypto.randomUUID()}`;
    const draft = makeDraft({ title: "v1" });

    try {
      await upsertDraftRecord(draft.id, userId, draft);

      const updated: DraftDoc = {
        ...draft,
        title: "v2",
        raw: "# updated",
        updatedAt: new Date(Date.now() + 1000).toISOString(),
      };
      await upsertDraftRecord(draft.id, userId, updated);

      const record = await getDraftRecord(draft.id);
      expect(record?.title).toBe("v2");
      expect(record?.raw).toBe("# updated");

      const all = await getDb().then((db) =>
        db.collection("drafts").countDocuments({ _id: draft.id } as never),
      );
      expect(all).toBe(1); // upsert, not a duplicate insert
    } finally {
      await cleanupDraft(draft.id);
    }
  });

  test("getDraftsByUser returns metadata only (no raw content), sorted most-recent-first", async () => {
    const userId = `test-user-${crypto.randomUUID()}`;
    const older = makeDraft({
      title: "Older",
      updatedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const newer = makeDraft({
      title: "Newer",
      updatedAt: new Date().toISOString(),
    });

    try {
      await upsertDraftRecord(older.id, userId, older);
      await upsertDraftRecord(newer.id, userId, newer);

      const metas = await getDraftsByUser(userId);
      const ids = metas.map((m) => m.id);
      expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));

      const newerMeta = metas.find((m) => m.id === newer.id);
      expect(newerMeta).toMatchObject({ id: newer.id, title: "Newer" });
      // Metadata shape only — no `raw`/`settings` fields leak through.
      expect((newerMeta as unknown as Record<string, unknown>).raw).toBeUndefined();
      expect(
        (newerMeta as unknown as Record<string, unknown>).settings,
      ).toBeUndefined();
    } finally {
      await cleanupDraft(older.id);
      await cleanupDraft(newer.id);
    }
  });

  test("getDraftsByUser never returns another user's drafts", async () => {
    const userA = `test-user-${crypto.randomUUID()}`;
    const userB = `test-user-${crypto.randomUUID()}`;
    const draftA = makeDraft({ title: "A's draft" });

    try {
      await upsertDraftRecord(draftA.id, userA, draftA);

      const metasB = await getDraftsByUser(userB);
      expect(metasB.some((m) => m.id === draftA.id)).toBe(false);

      const metasA = await getDraftsByUser(userA);
      expect(metasA.some((m) => m.id === draftA.id)).toBe(true);
    } finally {
      await cleanupDraft(draftA.id);
    }
  });

  test("deleteDraftRecord only deletes when the userId matches (ownership-scoped)", async () => {
    const owner = `test-user-${crypto.randomUUID()}`;
    const attacker = `test-user-${crypto.randomUUID()}`;
    const draft = makeDraft();

    try {
      await upsertDraftRecord(draft.id, owner, draft);

      // Wrong user: no-op, draft survives.
      await deleteDraftRecord(draft.id, attacker);
      expect(await getDraftRecord(draft.id)).not.toBeNull();

      // Right user: deleted.
      await deleteDraftRecord(draft.id, owner);
      expect(await getDraftRecord(draft.id)).toBeNull();
    } finally {
      await cleanupDraft(draft.id);
    }
  });
});

test.describe("decideDraftSyncDirection — last-write-wins reconciliation", () => {
  test("no local copy at all — always pull from cloud", () => {
    expect(decideDraftSyncDirection(null, "2026-01-01T00:00:00.000Z")).toBe(
      "pull",
    );
  });

  test("local is strictly newer than cloud — push local up", () => {
    expect(
      decideDraftSyncDirection(
        "2026-01-02T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      ),
    ).toBe("push");
  });

  test("cloud is strictly newer than local — pull cloud down", () => {
    expect(
      decideDraftSyncDirection(
        "2026-01-01T00:00:00.000Z",
        "2026-01-02T00:00:00.000Z",
      ),
    ).toBe("pull");
  });

  test("identical timestamps — already in sync, no-op", () => {
    const ts = "2026-01-01T12:00:00.000Z";
    expect(decideDraftSyncDirection(ts, ts)).toBe("noop");
  });

  test("ISO string comparison is lexicographic and millisecond-sensitive", () => {
    expect(
      decideDraftSyncDirection(
        "2026-01-01T00:00:00.001Z",
        "2026-01-01T00:00:00.000Z",
      ),
    ).toBe("push");
    expect(
      decideDraftSyncDirection(
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.001Z",
      ),
    ).toBe("pull");
  });
});
