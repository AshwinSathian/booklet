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
 * Deletes an account and everything it owns. Order matters: first what can
 * act for the user (so nothing writes while the rest goes), then the
 * content, and the user row last, so a failure part-way leaves an account
 * that can sign in and run the deletion again.
 *
 * Team spaces the user owns are deleted. Pages other people put in them
 * stay with their owners and leave the space.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const db = await getDb();
  const mine = { user_id: userId };

  await deleteAllUserSessions(userId);
  await revokeAllForUser(userId);
  await Promise.all(
    ["api_keys", "webhooks", "passkeys", "user_identities", "password_reset_tokens", "email_verification_tokens", "webauthn_challenges", "idempotency_keys"].map(
      (c) => db.collection(c).deleteMany(mine),
    ),
  );

  for (const page of await ownedPages(userId)) {
    await deleteDoc(page._id);
    await deletePageVersions(page._id);
    await deletePageAssociatedRecords(page._id);
  }
  await db.collection("pages").deleteMany(mine);
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

  await db.collection("users").deleteOne({ _id: userId } as never);
}
