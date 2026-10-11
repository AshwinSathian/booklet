import { unverifiedResponse } from "@/server/verification";
import type { PublishedDoc } from "@/lib/blocks";
import { resolveSettings } from "@/lib/blocks";
import { BLOCKS } from "@/lib/constants";
import { setPageLinks, updatePageRecord } from "@/lib/db";
import { collectRichBlockKinds } from "@/lib/block-usage";
import { recordPublishEvent } from "@/lib/db/publish-events";
import { snapshotPageVersion } from "@/lib/db/versions";
import { deliverWebhooks } from "@/lib/webhook-delivery";
import { getDoc, putDoc } from "@/lib/storage";
import { logError } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
import { assertNotTakenDown, buildDocument, getOwnedPage, type BuiltDocument } from "@/server/pages";
import { toErrorResponse, problem } from "@/server/errors";
import { getSiteOrigin } from "@/lib/site-url";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type UpdatePayload = {
  raw: string;
  settings?: PublishedDoc["settings"];
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = (await getSession())?.userId ?? null;
    if (!userId) {
      return problem(401, "Unauthorized");
    }

    const unverified = await unverifiedResponse(userId);
    if (unverified) return unverified;

    const { id } = await params;
    if (!id?.trim()) {
      return problem(400, "Missing page id");
    }

    let record;
    try {
      record = await getOwnedPage(id, userId);
      assertNotTakenDown(record);
    } catch (e) {
      return toErrorResponse(e);
    }

    let payload: UpdatePayload | null = null;
    try {
      payload = (await req.json()) as UpdatePayload;
    } catch {
      return problem(400, "Invalid JSON");
    }

    if (!payload?.raw || typeof payload.raw !== "string" || !payload.raw.trim()) {
      return problem(400, "Nothing to publish. Send the Markdown in `raw`.");
    }

    // Same pipeline as a first publish: see buildDocument.
    let built: BuiltDocument;
    try {
      built = await buildDocument(
        payload.raw,
        { id, userId, collectionId: record.collection_id, visibility: record.visibility },
        getSiteOrigin(req),
      );
    } catch (e) {
      return toErrorResponse(e);
    }
    const { blocks } = built;

    const doc: PublishedDoc = {
      v: BLOCKS.version,
      createdAt: record.created_at,
      // What the request did not send stays as the author left it.
      settings: resolveSettings(payload.settings, (await getDoc(id))?.settings),
      blocks,
      raw: payload.raw,
    };

    try {
      await putDoc(id, doc);
      void setPageLinks(id, built.linkTargetIds).catch((err) => logError("patch-publish", "Link write failed", err));
      void snapshotPageVersion(id, doc).catch((err) => {
        logError("patch-publish", "Version snapshot failed", err);
      });
    } catch (e: unknown) {
      logError("patch-publish", "Update failed", e);
      return problem(500, "The page was not updated. Try again.");
    }

    const updatedAt = new Date().toISOString();
    try {
      // The title, type and frontmatter fields follow the document.
      await updatePageRecord(id, { ...built.record, updated_at: updatedAt });
    } catch (dbErr) {
      logError("patch-publish", "DB record write failed", dbErr);
    }

    const publishedUrl = `${getSiteOrigin(req)}/p/${record.slug ?? id}`;

    void recordPublishEvent({
      userId,
      pageId: id,
      isUpdate: true,
      contentLength: payload.raw.length,
      richBlockKinds: collectRichBlockKinds(blocks),
      source: "browser",
    }).catch((err) => logError("patch-publish", "Event record failed", err));
    // The id URL, as in page.published: it outlives a change of slug.
    void deliverWebhooks(userId, "page.updated", {
      page_id: id,
      page_url: `${getSiteOrigin(req)}/p/${id}`,
      title: built.record.title,
      published_at: updatedAt,
    }).catch(() => {});

    return NextResponse.json({ id, url: publishedUrl, updated_at: updatedAt });
  } catch (e: unknown) {
    logError("patch-publish", "Unhandled error", e);
    return problem(500, "Something went wrong on the server. Try again.");
  }
}
