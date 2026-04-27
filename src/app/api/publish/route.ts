import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, ROUTES, STORAGE } from "@/lib/constants";
import { createPageRecord } from "@/lib/db";
import { ensureDbUser } from "@/lib/db/ensure-user";
import { createId } from "@/lib/id";
import { putDoc } from "@/lib/storage";
import { auth } from "@clerk/nextjs/server";
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
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = Math.floor(now / 60_000);
  const key = `__rl__publish__${ip}__${bucket}`;

  const kv = getCloudflareContext().env.READABLE_DOCS;

  const raw = await kv.get(key);
  const curr = raw ? Number(raw) : 0;
  const next = Number.isFinite(curr) ? curr + 1 : 1;

  const LIMIT_PER_MIN = 12;
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

  // Attempt to read Clerk session — optional; anonymous publish still works.
  const { userId, sessionClaims } = await auth();
  const isAuthenticated = Boolean(userId);

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
      return NextResponse.json(
        { error: "Document is too large to publish." },
        { status: 413 },
      );
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
  };

  try {
    await putDoc(id, doc, isAuthenticated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Publish failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // If authenticated, provision user row and create page ownership record.
  if (isAuthenticated && userId) {
    try {
      const email =
        (sessionClaims?.email as string | undefined) ??
        (sessionClaims?.primary_email_address as string | undefined) ??
        null;
      await ensureDbUser(userId, email);
      await createPageRecord(id, userId);
    } catch {
      // D1 write failure must not block the publish response.
      // The KV doc is already written; the page is live.
    }
  }

  const url = new URL(req.url);
  url.pathname = ROUTES.publish(id);
  url.search = "";
  url.hash = "";

  return NextResponse.json({
    id,
    url: url.toString(),
    owned: isAuthenticated,
  });
}
