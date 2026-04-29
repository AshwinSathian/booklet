import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, ROUTES, STORAGE } from "@/lib/constants";
import { createPageRecord } from "@/lib/db";
import { ensureDbUser } from "@/lib/db/ensure-user";
import { createId } from "@/lib/id";
import { extractDocTitle } from "@/lib/doc-title";
import { putDoc } from "@/lib/storage";
import { QuotaExceededError, quotaErrorResponse } from "@/lib/quota";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishPayload = {
  blocks: PublishedDoc["blocks"];
  settings?: PublishedDoc["settings"];
  raw?: string;
};

function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;

  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";

  return "unknown";
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`publish__ip__${ip}`, 12);
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
    ...(payload.raw ? { raw: payload.raw.slice(0, STORAGE.maxInputChars) } : {}),
  };

  try {
    await putDoc(id, doc, isAuthenticated);
  } catch (e: unknown) {
    if (e instanceof QuotaExceededError) return quotaErrorResponse(e);
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
      const title = extractDocTitle(payload.blocks);
      await ensureDbUser(userId, email);
      await createPageRecord(id, userId, title);
    } catch (dbErr) {
      // D1 write failure must not block the publish response.
      // The KV doc is already written; the page is live.
      console.error("[publish] D1 ownership write failed:", dbErr);
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
