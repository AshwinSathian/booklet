import { test, expect } from "@playwright/test";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { createCollectionRecord, getCollectionRecord, getCollectionChildren, deleteCollectionRecord } from "@/lib/db";
import { createId } from "@/lib/id";
import { resolveParent, assertCanNest } from "@/server/collections";
import { ServiceError } from "@/server/errors";

test.beforeAll(async () => {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017/readable?retryWrites=true&w=majority";
  const db = await getDb();
  await ensureIndexes(db);
});

async function cleanup(ids: string[]) {
  const db = await getDb();
  await db.collection("collections").deleteMany({ _id: { $in: ids } } as never);
}

test.describe("parent_id on collections", () => {
  test("a collection created with no parentId defaults to parent_id: null", async () => {
    const userId = `testuser${createId(8)}`;
    const id = createId(10);
    try {
      await createCollectionRecord(id, userId, "Top level");
      const record = await getCollectionRecord(id);
      expect(record?.parent_id).toBeNull();
    } finally {
      await cleanup([id]);
    }
  });

  test("a collection created with a parentId persists it", async () => {
    const userId = `testuser${createId(8)}`;
    const parentId = createId(10);
    const childId = createId(10);
    try {
      await createCollectionRecord(parentId, userId, "Parent");
      await createCollectionRecord(childId, userId, "Child", false, parentId);
      const record = await getCollectionRecord(childId);
      expect(record?.parent_id).toBe(parentId);
    } finally {
      await cleanup([parentId, childId]);
    }
  });
});

test.describe("per-parent name uniqueness", () => {
  test("same name is allowed at top-level and inside a different folder", async () => {
    const userId = `testuser${createId(8)}`;
    const folderId = createId(10);
    const topId = createId(10);
    const nestedId = createId(10);
    try {
      await createCollectionRecord(folderId, userId, "Container");
      await createCollectionRecord(topId, userId, "Drafts");
      await expect(createCollectionRecord(nestedId, userId, "Drafts", false, folderId)).resolves.toBeUndefined();
    } finally {
      await cleanup([folderId, topId, nestedId]);
    }
  });

  test("same name in the same parent collides", async () => {
    const userId = `testuser${createId(8)}`;
    const firstId = createId(10);
    const secondId = createId(10);
    try {
      await createCollectionRecord(firstId, userId, "Duplicate");
      await expect(createCollectionRecord(secondId, userId, "Duplicate")).rejects.toThrow(/E11000/);
    } finally {
      await cleanup([firstId, secondId]);
    }
  });
});

test.describe("getCollectionChildren", () => {
  test("returns direct children only, not grandchildren", async () => {
    const userId = `testuser${createId(8)}`;
    const parentId = createId(10);
    const childId = createId(10);
    const unrelatedId = createId(10);
    try {
      await createCollectionRecord(parentId, userId, "Parent");
      await createCollectionRecord(childId, userId, "Child", false, parentId);
      await createCollectionRecord(unrelatedId, userId, "Unrelated");
      const children = await getCollectionChildren(parentId);
      expect(children.map((c) => c.id)).toEqual([childId]);
    } finally {
      await cleanup([parentId, childId, unrelatedId]);
    }
  });
});

test.describe("deleteCollectionRecord cascade", () => {
  test("deleting a parent folder deletes its children and unlinks pages in both", async () => {
    const userId = `testuser${createId(8)}`;
    const parentId = createId(10);
    const childId = createId(10);
    const parentPageId = createId(10);
    const childPageId = createId(10);
    try {
      await createCollectionRecord(parentId, userId, "Parent");
      await createCollectionRecord(childId, userId, "Child", false, parentId);
      const db = await getDb();
      const now = new Date().toISOString();
      // slug is intentionally omitted, not set to null — the pages.slug
      // index is sparse-unique, and an explicit null is still an indexed
      // value (would collide across these two inserts). See the identical
      // reasoning on CollectionDoc/PageDoc in src/lib/db/index.ts.
      await db.collection("pages").insertMany([
        { _id: parentPageId, user_id: userId, title: "Parent page", visibility: "public", collection_id: parentId, team_id: null, view_count: 0, remove_attribution_badge: false, password_hash: null, featured: false, frontmatter_meta: null, created_at: now, updated_at: now },
        { _id: childPageId, user_id: userId, title: "Child page", visibility: "public", collection_id: childId, team_id: null, view_count: 0, remove_attribution_badge: false, password_hash: null, featured: false, frontmatter_meta: null, created_at: now, updated_at: now },
      ] as never);

      await deleteCollectionRecord(parentId, userId);

      expect(await getCollectionRecord(parentId)).toBeNull();
      expect(await getCollectionRecord(childId)).toBeNull();
      const parentPage = await db.collection("pages").findOne({ _id: parentPageId } as never);
      const childPage = await db.collection("pages").findOne({ _id: childPageId } as never);
      expect((parentPage as { collection_id: unknown } | null)?.collection_id).toBeNull();
      expect((childPage as { collection_id: unknown } | null)?.collection_id).toBeNull();

      await db.collection("pages").deleteMany({ _id: { $in: [parentPageId, childPageId] } } as never);
    } finally {
      await cleanup([parentId, childId]);
    }
  });
});

test.describe("resolveParent", () => {
  test("null parentId resolves to null (top-level)", async () => {
    const userId = `testuser${createId(8)}`;
    await expect(resolveParent(null, userId)).resolves.toBeNull();
  });

  test("a valid top-level, owned, non-team-space parent resolves", async () => {
    const userId = `testuser${createId(8)}`;
    const parentId = createId(10);
    try {
      await createCollectionRecord(parentId, userId, "Parent");
      const resolved = await resolveParent(parentId, userId);
      expect(resolved?.id).toBe(parentId);
    } finally {
      await cleanup([parentId]);
    }
  });

  test("a parent owned by someone else is rejected", async () => {
    const ownerId = `testuser${createId(8)}`;
    const otherId = `testuser${createId(8)}`;
    const parentId = createId(10);
    try {
      await createCollectionRecord(parentId, ownerId, "Parent");
      await expect(resolveParent(parentId, otherId)).rejects.toThrow(ServiceError);
    } finally {
      await cleanup([parentId]);
    }
  });

  test("a sub-folder can't itself be a parent (2-level cap)", async () => {
    const userId = `testuser${createId(8)}`;
    const topId = createId(10);
    const subId = createId(10);
    try {
      await createCollectionRecord(topId, userId, "Top");
      await createCollectionRecord(subId, userId, "Sub", false, topId);
      await expect(resolveParent(subId, userId)).rejects.toThrow(/Sub-folders can't contain folders/);
    } finally {
      await cleanup([topId, subId]);
    }
  });

  test("a team space can't be a nesting parent", async () => {
    const userId = `testuser${createId(8)}`;
    const teamId = createId(10);
    try {
      await createCollectionRecord(teamId, userId, "Team", true);
      await expect(resolveParent(teamId, userId)).rejects.toThrow(/Team spaces/);
    } finally {
      await cleanup([teamId]);
    }
  });
});

test.describe("assertCanNest", () => {
  test("a folder with no children can be nested", async () => {
    const userId = `testuser${createId(8)}`;
    const id = createId(10);
    try {
      await createCollectionRecord(id, userId, "Childless");
      await expect(assertCanNest(id)).resolves.toBeUndefined();
    } finally {
      await cleanup([id]);
    }
  });

  test("a folder with children can't be nested", async () => {
    const userId = `testuser${createId(8)}`;
    const parentId = createId(10);
    const childId = createId(10);
    try {
      await createCollectionRecord(parentId, userId, "Parent");
      await createCollectionRecord(childId, userId, "Child", false, parentId);
      await expect(assertCanNest(parentId)).rejects.toThrow(/contains sub-folders/);
    } finally {
      await cleanup([parentId, childId]);
    }
  });
});
