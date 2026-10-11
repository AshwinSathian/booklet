import { test, expect } from "@playwright/test";
import { getDb } from "@/lib/mongodb";
import { ensureIndexes } from "@/lib/db/index-specs.mjs";
import { createCollectionRecord, getCollectionRecord, getCollectionChildren, deleteCollectionRecord, getPagesByCollection, getPublicPagesForSitemap } from "@/lib/db";
import { createId } from "@/lib/id";
import { resolveParent, assertCanNest } from "@/server/collections";
import { ServiceError } from "@/server/errors";

test.beforeAll(async () => {
  process.env.MONGODB_URI ??= "mongodb://localhost:27017/booklet?retryWrites=true&w=majority";
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
        { _id: parentPageId, user_id: userId, title: "Parent page", visibility: "public", collection_id: parentId, team_id: null, view_count: 0, password_hash: null, frontmatter_meta: null, created_at: now, updated_at: now },
        { _id: childPageId, user_id: userId, title: "Child page", visibility: "public", collection_id: childId, team_id: null, view_count: 0, password_hash: null, frontmatter_meta: null, created_at: now, updated_at: now },
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

test.describe("deleting a team space", () => {
  test("every member's page leaves the space, and the membership rows go with it", async () => {
    const owner = `testuser${createId(8)}`;
    const member = `testuser${createId(8)}`;
    const spaceId = createId(10);
    const ownerPage = createId(10);
    const memberPage = createId(10);
    const db = await getDb();
    try {
      await createCollectionRecord(spaceId, owner, "Space", true);
      const now = new Date().toISOString();
      const page = { visibility: "team", collection_id: spaceId, team_id: spaceId, view_count: 0, password_hash: null, frontmatter_meta: null, created_at: now, updated_at: now };
      await db.collection("pages").insertMany([
        { ...page, _id: ownerPage, user_id: owner, title: "Owner's" },
        { ...page, _id: memberPage, user_id: member, title: "Member's" },
      ] as never);
      await db.collection("collection_members").insertOne({ _id: createId(10), collection_id: spaceId, user_id: member, email: "m@example.test", role: "editor", invited_by: owner, created_at: now } as never);

      // Someone who does not own it deletes nothing.
      await deleteCollectionRecord(spaceId, member);
      expect(await getCollectionRecord(spaceId)).not.toBeNull();

      await deleteCollectionRecord(spaceId, owner);
      expect(await getCollectionRecord(spaceId)).toBeNull();
      for (const id of [ownerPage, memberPage]) {
        const row = (await db.collection("pages").findOne({ _id: id } as never)) as { collection_id: unknown } | null;
        expect(row?.collection_id, id).toBeNull();
      }
      expect(await db.collection("collection_members").countDocuments({ collection_id: spaceId })).toBe(0);
    } finally {
      await db.collection("pages").deleteMany({ _id: { $in: [ownerPage, memberPage] } } as never);
      await db.collection("collection_members").deleteMany({ collection_id: spaceId });
      await cleanup([spaceId]);
    }
  });
});

test.describe("getPagesByCollection", () => {
  test("a public page with a password is not listed", async () => {
    const userId = `testuser${createId(8)}`;
    const collectionId = createId(10);
    const openId = createId(10);
    const lockedId = createId(10);
    const db = await getDb();
    try {
      await createCollectionRecord(collectionId, userId, "Listed");
      const now = new Date().toISOString();
      // slug omitted, as above.
      const page = { user_id: userId, visibility: "public", collection_id: collectionId, team_id: null, view_count: 0, frontmatter_meta: null, created_at: now, updated_at: now };
      await db.collection("pages").insertMany([
        { ...page, _id: openId, title: "Open page", password_hash: null },
        { ...page, _id: lockedId, title: "Locked page", password_hash: "x" },
      ] as never);

      expect((await getPagesByCollection(collectionId)).map((p) => p.id)).toEqual([openId]);
    } finally {
      await db.collection("pages").deleteMany({ _id: { $in: [openId, lockedId] } } as never);
      await cleanup([collectionId]);
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

test("the sitemap lists a public page by its custom address, and no unlisted, locked or taken-down page", async () => {
  const db = await getDb();
  const now = new Date().toISOString();
  const ids = Array.from({ length: 5 }, () => createId(10));
  const slug = `sitemap-${createId(8).toLowerCase()}`;
  const page = { user_id: `testuser${createId(8)}`, title: "Page", visibility: "public", collection_id: null, team_id: null, view_count: 0, password_hash: null, frontmatter_meta: null, created_at: now, updated_at: now };
  try {
    await db.collection("pages").insertMany([
      { ...page, _id: ids[0], slug },
      { ...page, _id: ids[1] },
      { ...page, _id: ids[2], visibility: "unlisted" },
      { ...page, _id: ids[3], password_hash: "x" },
      { ...page, _id: ids[4], taken_down_at: now },
    ] as never);
    const keys = (await getPublicPagesForSitemap()).map((entry) => entry.key);
    expect(keys).toContain(slug);
    expect(keys).toContain(ids[1]);
    for (const id of [ids[0], ids[2], ids[3], ids[4]]) expect(keys).not.toContain(id);
  } finally {
    await db.collection("pages").deleteMany({ _id: { $in: ids } } as never);
  }
});
