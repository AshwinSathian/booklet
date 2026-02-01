import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, ROUTES, STORAGE } from "@/lib/constants";
import { createId } from "@/lib/id";
import { putDoc } from "@/lib/storage";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishPayload = {
  blocks: PublishedDoc["blocks"];
  settings?: PublishedDoc["settings"];
};

function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;

  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";

  return "unknown";
}

async function rateLimitPublish(req: Request): Promise<null | NextResponse> {
  // Minimal protection:
  // - Limit approx N requests per minute per IP
  // - Uses READABLE_DOCS KV with a reserved prefix
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = Math.floor(now / 60_000); // per-minute bucket
  const key = `__rl__publish__${ip}__${bucket}`;

  const kv = getCloudflareContext().env.READABLE_DOCS;

  const raw = await kv.get(key);
  const curr = raw ? Number(raw) : 0;
  const next = Number.isFinite(curr) ? curr + 1 : 1;

  // Tweakable limits (kept conservative)
  const LIMIT_PER_MIN = 12;

  // Best-effort write; KV isn't atomic, but it's good enough for Phase 1.
  await kv.put(key, String(next), { expirationTtl: 90 });

  if (next > LIMIT_PER_MIN) {
    return NextResponse.json(
      { error: "Too many publishes. Please slow down and try again." },
      { status: 429 },
    );
  }

  return null;
}

export async function POST(req: Request) {
  const rl = await rateLimitPublish(req);
  if (rl) return rl;

  let payload: PublishPayload | null = null;

  try {
    payload = (await req.json()) as PublishPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload?.blocks?.length) {
    return NextResponse.json({ error: "Nothing to publish" }, { status: 400 });
  }

  // Guard payload size early (fast fail before KV write)
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    if (bytes.byteLength > STORAGE.maxDocBytes) {
      return NextResponse.json(
        { error: "Document is too large to publish." },
        { status: 413 },
      );
    }
  } catch {
    // If stringify fails, reject the request
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const id = createId(10);
  const doc: PublishedDoc = {
    v: BLOCKS.version,
    createdAt: new Date().toISOString(),
    settings: payload.settings ?? DEFAULT_SETTINGS,
    blocks: payload.blocks,
  };

  try {
    await putDoc(id, doc);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Publish failed" },
      { status: 500 },
    );
  }

  // Build absolute URL at runtime
  const url = new URL(req.url);
  url.pathname = ROUTES.publish(id);
  url.search = "";
  url.hash = "";

  return NextResponse.json({ id, url: url.toString() });
}
