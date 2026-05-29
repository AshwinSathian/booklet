import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, STORAGE } from "@/lib/constants";
import { getPageRecord, updatePageRecord } from "@/lib/db";
import { snapshotPageVersion } from "@/lib/db/versions";
import { putDoc } from "@/lib/storage";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type UpdatePayload = {
  blocks: PublishedDoc["blocks"];
  settings?: PublishedDoc["settings"];
  raw?: string;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Missing page id" }, { status: 400 });
    }

    const record = await getPageRecord(id);
    if (!record) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }
    if (record.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let payload: UpdatePayload | null = null;
    try {
      payload = (await req.json()) as UpdatePayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!payload?.blocks?.length) {
      return NextResponse.json({ error: "Nothing to publish" }, { status: 400 });
    }

    try {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
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
      blocks: payload.blocks,
      ...(payload.raw ? { raw: payload.raw.slice(0, STORAGE.maxInputChars) } : {}),
    };

    try {
      await putDoc(id, doc, true);
      void snapshotPageVersion(id, doc).catch((err) => {
        console.error("[patch-publish] version snapshot failed:", err);
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Update failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const updatedAt = new Date().toISOString();
    try {
      await updatePageRecord(id, { updated_at: updatedAt });
    } catch (dbErr) {
      console.error("[patch-publish] DB updated_at write failed:", dbErr);
    }

    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
      : new URL(req.url).origin;
    const publishedUrl = `${siteOrigin}/p/${record.slug ?? id}`;

    return NextResponse.json({ id, url: publishedUrl, updated_at: updatedAt });
  } catch (e: unknown) {
    console.error("[patch-publish] Unhandled error:", e);
    const msg = e instanceof Error ? e.message : "An unexpected error occurred";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
