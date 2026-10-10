import yaml from "js-yaml";
import { deletePageAssociatedRecords } from "@/lib/db";
import { deleteAllUserSessions } from "@/lib/db/auth";
import { deletePageVersions } from "@/lib/db/versions";
import type { DbPage } from "@/lib/db/types";
import { stripFrontmatter } from "@/lib/frontmatter";
import { getDb } from "@/lib/mongodb";
import { revokeAllForUser } from "@/lib/oauth/server";
import { deleteDoc, getDoc } from "@/lib/storage";
import { zipTextFiles } from "@/lib/zip";

type PageRow = Omit<DbPage, "id"> & { _id: string };

async function ownedPages(userId: string): Promise<PageRow[]> {
  return (await getDb()).collection<PageRow>("pages").find({ user_id: userId }).sort({ created_at: 1 }).toArray();
}

/**
 * Every page the user owns as a ZIP of Markdown files, one per page. Each
 * starts with frontmatter built from the page record (so the title, slug
 * and visibility in the file are the published ones), followed by the
 * document without whatever frontmatter it was published with.
 */
export async function exportPagesZip(userId: string, origin: string): Promise<Buffer> {
  const files: Array<{ name: string; content: string }> = [];
  for (const page of await ownedPages(userId)) {
    // A taken-down page is not handed back, here or anywhere else.
    if (page.taken_down_at) continue;
    const doc = await getDoc(page._id);
    if (!doc) continue;
    const frontmatter = yaml.dump(
      {
        ...(page.frontmatter_meta ?? {}),
        title: page.title ?? "Untitled",
        ...(page.slug ? { slug: page.slug } : {}),
        visibility: page.visibility,
        url: `${origin}/p/${page.slug ?? page._id}`,
        created: page.created_at,
        updated: page.updated_at,
      },
      { lineWidth: -1 },
    );
    files.push({
      // The ID keeps names unique; the slug makes them readable.
      name: `${page.slug ? `${page.slug}-` : ""}${page._id}.md`,
      content: `---\n${frontmatter}---\n\n${
        doc.raw
          ? stripFrontmatter(doc.raw).trimStart()
          : "<!-- This page was published before Booklet kept the Markdown source. Its content is at the url above. -->\n"
      }`,
    });
  }
  return zipTextFiles(files);
}

/**
 * Deletes an account and what it owns. Order matters. First what can act
 * for the user without them (API keys, webhooks, connected apps), so
 * nothing writes while the rest goes. Then the content. The ways to sign in
 * and the user row go last, so a failure part-way leaves an account its
 * owner can still sign in to and delete again.
 *
 * A page an admin took down is kept, with its record: deleting it would
 * turn its 410 into a 404 and free its slug for a fresh copy at the same
 * URL, which is what the freeze on taken-down pages exists to prevent (see
 * assertNotTakenDown). It no longer has an owner.
 *
 * Team spaces the user owns are deleted. Pages other people put in them
 * stay with their owners and leave the space.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const db = await getDb();
  const mine = { user_id: userId };
  const removeAll = (collections: string[]) => Promise.all(collections.map((c) => db.collection(c).deleteMany(mine)));

  await revokeAllForUser(userId);
  await removeAll(["api_keys", "webhooks", "webhook_deliveries", "idempotency_keys"]);

  for (const page of await ownedPages(userId)) {
    if (page.taken_down_at) continue;
    await deleteDoc(page._id);
    await deletePageVersions(page._id);
    await deletePageAssociatedRecords(page._id);
  }
  // `taken_down_at: null` also matches records that predate the field.
  await db.collection("pages").deleteMany({ ...mine, taken_down_at: null });
  await db.collection("drafts").deleteMany(mine);

  const collectionIds = (await db.collection<{ _id: string }>("collections").find(mine).project({ _id: 1 }).toArray()).map((c) => c._id);
  if (collectionIds.length) {
    await db
      .collection("pages")
      .updateMany({ collection_id: { $in: collectionIds } }, { $set: { collection_id: null, team_id: null } });
    await db.collection("collection_members").deleteMany({ collection_id: { $in: collectionIds } });
    await db.collection("collections").deleteMany(mine);
  }
  await db.collection("collection_members").deleteMany(mine);

  await removeAll(["passkeys", "user_identities", "password_reset_tokens", "email_verification_tokens", "webauthn_challenges"]);
  await deleteAllUserSessions(userId);
  await db.collection("users").deleteOne({ _id: userId } as never);
}
