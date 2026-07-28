import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, STORAGE } from "@/lib/constants";
import { updatePageRecord } from "@/lib/db";
import { snapshotPageVersion } from "@/lib/db/versions";
import { parseToBlocks } from "@/lib/parse";
import { stripWikilinksFromBlocks } from "@/lib/wikilinks/strip";
import { stripFrontmatter } from "@/lib/frontmatter";
import { validateBlocks } from "@/lib/block-schema";
import { putDoc } from "@/lib/storage";
import { logError } from "@/lib/logger";
import { getSession } from "@/lib/auth/session";
import { getOwnedPage } from "@/server/pages";
import { toErrorResponse } from "@/server/errors";
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Missing page id" }, { status: 400 });
    }

    let record;
    try {
      record = await getOwnedPage(id, userId);
    } catch (e) {
      return toErrorResponse(e);
    }

    let payload: UpdatePayload | null = null;
    try {
      payload = (await req.json()) as UpdatePayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!payload?.raw || typeof payload.raw !== "string" || !payload.raw.trim()) {
      return NextResponse.json({ error: "Nothing to publish — provide `raw` markdown." }, { status: 400 });
    }

    // `blocks` is always derived server-side from `raw` — see
    // src/lib/block-schema.ts's header for why a client-supplied block tree
    // is no longer accepted anywhere. This route previously accepted
    // `blocks` directly with no shape validation at all (unlike the other
    // three publish/patch routes, which at least ran validateBlocks against
    // a client-supplied tree) — deriving from `raw` here closes that gap
    // the same way as the others, rather than adding a third, different
    // partial fix.
    // See src/lib/blocks.ts's `Inline` doc comment: wikilinks are private
    // and drafting-time-only, stripped to plain text before storage.
    const blocks = stripWikilinksFromBlocks(parseToBlocks(stripFrontmatter(payload.raw)));
    if (!blocks.length) {
      return NextResponse.json({ error: "Nothing to publish" }, { status: 400 });
    }

    const blocksError = validateBlocks(blocks);
    if (blocksError) {
      logError("patch-publish", "Parser produced an invalid block shape", new Error(blocksError));
      return NextResponse.json({ error: "Failed to parse document. Please report this." }, { status: 500 });
    }

    try {
      const bytes = new TextEncoder().encode(JSON.stringify({ blocks, raw: payload.raw }));
      if (bytes.byteLength > STORAGE.maxDocBytes) {
        return NextResponse.json(
          { error: "Document is too large." },
          { status: 413 },
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const doc: PublishedDoc = {
      v: BLOCKS.version,
      createdAt: record.created_at,
      settings: payload.settings ?? DEFAULT_SETTINGS,
      blocks,
      raw: payload.raw.slice(0, STORAGE.maxInputChars),
    };

    try {
      await putDoc(id, doc);
      void snapshotPageVersion(id, doc).catch((err) => {
        logError("patch-publish", "Version snapshot failed", err);
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Update failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const updatedAt = new Date().toISOString();
    try {
      await updatePageRecord(id, { updated_at: updatedAt });
    } catch (dbErr) {
      logError("patch-publish", "DB updated_at write failed", dbErr);
    }

    const publishedUrl = `${getSiteOrigin(req)}/p/${record.slug ?? id}`;

    return NextResponse.json({ id, url: publishedUrl, updated_at: updatedAt });
  } catch (e: unknown) {
    logError("patch-publish", "Unhandled error", e);
    const msg = e instanceof Error ? e.message : "An unexpected error occurred";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
