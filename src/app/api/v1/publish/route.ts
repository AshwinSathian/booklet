import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, ROUTES, STORAGE } from "@/lib/constants";
import { createPageRecord } from "@/lib/db";
import { ensureDbUser } from "@/lib/db/ensure-user";
import { createId } from "@/lib/id";
import { resolveApiKey } from "@/lib/api-key-auth";
import { extractDocTitle } from "@/lib/doc-title";
import { parseToBlocks } from "@/lib/parse";
import { putDoc } from "@/lib/storage";
import { QuotaExceededError, quotaErrorResponse } from "@/lib/quota";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishPayload = {
  blocks?: PublishedDoc["blocks"];
  raw?: string;
  settings?: PublishedDoc["settings"];
};

export async function POST(req: Request) {
  const userId = await resolveApiKey(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await checkRateLimit(`v1__publish__${userId}`, 60);
  if (rl) return rl;

  let payload: PublishPayload | null = null;
  try {
    payload = (await req.json()) as PublishPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload?.raw && typeof payload.raw === "string") {
    payload = { ...payload, blocks: parseToBlocks(payload.raw) };
  }

  if (!payload?.blocks?.length) {
    return NextResponse.json({ error: "Nothing to publish — provide `blocks` or `raw` markdown." }, { status: 400 });
  }

  try {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (bytes.byteLength > STORAGE.maxDocBytes) {
      return NextResponse.json({ error: "Document too large." }, { status: 413 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const id = createId(10);
  const doc: PublishedDoc = {
    v: BLOCKS.version,
    createdAt: new Date().toISOString(),
    settings: payload.settings ?? DEFAULT_SETTINGS,
    blocks: payload.blocks,
    ...(payload.raw ? { raw: payload.raw.slice(0, STORAGE.maxInputChars) } : {}),
  };

  try {
    await putDoc(id, doc, true);
  } catch (e: unknown) {
    if (e instanceof QuotaExceededError) return quotaErrorResponse(e);
    const msg = e instanceof Error ? e.message : "Publish failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    const title = extractDocTitle(payload.blocks);
    await ensureDbUser(userId, null);
    await createPageRecord(id, userId, title);
  } catch (dbErr) {
    console.error("[v1/publish] D1 write failed:", dbErr);
  }

  const url = new URL(req.url);
  url.pathname = ROUTES.publish(id);
  url.search = "";
  url.hash = "";

  return NextResponse.json({ id, url: url.toString() }, { status: 201 });
}
