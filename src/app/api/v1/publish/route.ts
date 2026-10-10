import { assertVerified } from "@/server/verification";
import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, ROUTES } from "@/lib/constants";
import { createPageRecord, setPageLinks, updatePageRecord } from "@/lib/db";
import { createId } from "@/lib/id";
import { snapshotPageVersion } from "@/lib/db/versions";
import { recordPublishEvent } from "@/lib/db/publish-events";
import { deliverWebhooks } from "@/lib/webhook-delivery";
import { collectRichBlockKinds } from "@/lib/block-usage";
import { deleteDoc, putDoc } from "@/lib/storage";
import { assertVisibilityAllowed, getWritableSpace } from "@/server/access";
import { assertRawWithinLimit, assertSlugAvailable, buildDocument } from "@/server/pages";
import { parseFrontmatter } from "@/lib/frontmatter";
import { problem } from "@/server/errors";
import { idempotent } from "@/server/idempotency";
import { v1 } from "@/server/v1";
import { getSiteOrigin } from "@/lib/site-url";
import { resolveApiClientSource } from "@/lib/request-source";
import { logError } from "@/lib/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishPayload = {
  raw?: string;
  settings?: PublishedDoc["settings"];
  /** Overrides frontmatter `visibility`. Unknown values are ignored. */
  visibility?: unknown;
  /** Slug of a team space to create the page in. Overrides frontmatter `space`. */
  space?: unknown;
};

export const POST = v1("publish", 60, "pages:write", async (req: Request, userId: string) => {
  await assertVerified(userId);
  const bodyText = await req.text();
  return idempotent(req, userId, bodyText, () => publish(req, userId, bodyText));
});

async function publish(req: Request, userId: string, bodyText: string): Promise<Response> {
  let payload: PublishPayload | null = null;
  try {
    payload = JSON.parse(bodyText) as PublishPayload;
  } catch {
    return problem(400, "Invalid JSON");
  }

  if (!payload?.raw || typeof payload.raw !== "string" || !payload.raw.trim()) {
    return problem(400, "Nothing to publish — provide `raw` markdown.");
  }

  // First, as before: nothing parses or looks anything up for a document
  // that is too large to store.
  assertRawWithinLimit(payload.raw);

  // Where the page goes and who may read it are settled next: they decide
  // which pages its `[[Title]]` links may point at.
  const declared = parseFrontmatter(payload.raw).meta;
  const spaceSlug = payload.space ?? declared.space;
  const space = spaceSlug == null ? null : await getWritableSpace({ slug: spaceSlug }, userId);
  const visibility =
    payload.visibility === "public" || payload.visibility === "unlisted" || payload.visibility === "team"
      ? payload.visibility
      : (declared.visibility ?? "unlisted");
  await assertVisibilityAllowed(visibility, space?.id ?? null, userId);

  const id = createId(10);
  const origin = getSiteOrigin(req);
  const built = await buildDocument(payload.raw, { id, userId, collectionId: space?.id ?? null, visibility }, origin);
  const { fm, blocks } = built;

  // Validate + collision-check a frontmatter-supplied slug up front, before
  // any writes happen.
  let normalizedSlug: string | null = null;
  if (fm.slug) {
    normalizedSlug = fm.slug.trim().toLowerCase();
    await assertSlugAvailable(normalizedSlug, null);
  }

  const doc: PublishedDoc = {
    v: BLOCKS.version,
    createdAt: new Date().toISOString(),
    settings: payload.settings ?? DEFAULT_SETTINGS,
    blocks,
    raw: payload.raw,
  };

  try {
    await putDoc(id, doc);
  } catch (e: unknown) {
    logError("v1/publish", "Publish failed", e);
    return problem(500, "Publish failed");
  }

  // The record is what makes a page owned, and what a team-only page's
  // access check reads. Without it the document would be an ownerless page
  // open to anyone with the link, so a failure here undoes the publish.
  try {
    await createPageRecord(id, userId, built.record.title, null, built.record.frontmatter_meta, visibility, {
      collectionId: space?.id ?? null,
      docType: built.record.doc_type,
    });
  } catch (dbErr) {
    logError("v1/publish", "DB write failed", dbErr);
    await deleteDoc(id).catch(() => {});
    return problem(500, "Publish failed");
  }

  // After the page record: the event also writes the record's `last_source`.
  void recordPublishEvent({
    userId,
    pageId: id,
    isUpdate: false,
    contentLength: payload.raw.length,
    richBlockKinds: collectRichBlockKinds(blocks),
    source: resolveApiClientSource(req),
  }).catch((err) => logError("v1/publish", "Event record failed", err));

  // The slug was validated above, but that check-then-write isn't atomic: a
  // concurrent publish can claim the same slug in between, and the write
  // then loses to the unique index (E11000). The page is published either
  // way (it's reachable at /p/:id); this only decides whether the caller is
  // told their slug didn't take.
  let slugConflict = false;
  if (normalizedSlug) {
    await updatePageRecord(id, { slug: normalizedSlug }).catch((e) => {
      logError("v1/publish", "Slug write failed", e);
      if (typeof e === "object" && e !== null && "code" in e && e.code === 11000) slugConflict = true;
    });
  }

  void setPageLinks(id, built.linkTargetIds).catch((err) => logError("v1/publish", "Link write failed", err));
  void snapshotPageVersion(id, doc).catch((err) => {
    logError("v1/publish", "Version snapshot failed", err);
  });
  void deliverWebhooks(userId, "page.published", {
    page_id: id,
    page_url: `${origin}/p/${id}`,
    title: built.record.title,
    published_at: doc.createdAt,
  }).catch(() => {});

  return NextResponse.json(
    {
      id,
      url: `${origin}${ROUTES.publish(id)}`,
      ...(slugConflict
        ? {
            warning: `The slug "${normalizedSlug}" was claimed by another page between validation and publish; this page published at its default URL instead.`,
          }
        : {}),
    },
    { status: 201 },
  );
}
