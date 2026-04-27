import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, ROUTES, STORAGE } from "@/lib/constants";
import { countUserPages, createPageRecord } from "@/lib/db";
import { ensureDbUser } from "@/lib/db/ensure-user";
import { FREE_PAGE_LIMIT, isPro } from "@/lib/db/gates";
import { createId } from "@/lib/id";
import { resolveApiKey } from "@/lib/api-key-auth";
import { putDoc } from "@/lib/storage";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishPayload = {
  blocks: PublishedDoc["blocks"];
  settings?: PublishedDoc["settings"];
};

export async function POST(req: Request) {
  const userId = await resolveApiKey(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: PublishPayload | null = null;
  try {
    payload = (await req.json()) as PublishPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.blocks?.length) {
    return NextResponse.json({ error: "Nothing to publish" }, { status: 400 });
  }

  try {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (bytes.byteLength > STORAGE.maxDocBytes) {
      return NextResponse.json({ error: "Document too large." }, { status: 413 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Enforce page limit.
  try {
    const [count, pro] = await Promise.all([countUserPages(userId), isPro(userId)]);
    if (!pro && count >= FREE_PAGE_LIMIT) {
      return NextResponse.json(
        { error: "Free plan limit reached.", code: "page_limit_reached" },
        { status: 402 },
      );
    }
  } catch {
    console.error("[v1/publish] gate check failed");
  }

  const id = createId(10);
  const doc: PublishedDoc = {
    v: BLOCKS.version,
    createdAt: new Date().toISOString(),
    settings: payload.settings ?? DEFAULT_SETTINGS,
    blocks: payload.blocks,
  };

  try {
    await putDoc(id, doc, true);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Publish failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    await ensureDbUser(userId, null);
    await createPageRecord(id, userId);
  } catch (dbErr) {
    console.error("[v1/publish] D1 write failed:", dbErr);
  }

  const url = new URL(req.url);
  url.pathname = ROUTES.publish(id);
  url.search = "";
  url.hash = "";

  return NextResponse.json({ id, url: url.toString() }, { status: 201 });
}
