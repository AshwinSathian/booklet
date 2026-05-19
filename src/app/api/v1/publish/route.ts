import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, ROUTES, STORAGE } from "@/lib/constants";
import { createPageRecord, getUserPlan, updatePageRecord } from "@/lib/db";
import { ensureDbUser } from "@/lib/db/ensure-user";
import { createId } from "@/lib/id";
import { resolveApiKey } from "@/lib/api-key-auth";
import { extractDocTitle } from "@/lib/doc-title";
import { snapshotPageVersion } from "@/lib/db/versions";
import { recordPublishEvent } from "@/lib/db/publish-events";
import { parseFrontmatter } from "@/lib/frontmatter";
import { canUseFeature } from "@/lib/quota";
import { deliverWebhooks } from "@/lib/webhook-delivery";
import { parseToBlocks } from "@/lib/parse";
import { putDoc } from "@/lib/storage";
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

  // Extract frontmatter metadata before parsing
  let frontmatterMeta = {};
  if (payload?.raw && typeof payload.raw === "string") {
    const { meta, body } = parseFrontmatter(payload.raw);
    frontmatterMeta = meta;
    payload = { ...payload, raw: body, blocks: parseToBlocks(body) };
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
    const msg = e instanceof Error ? e.message : "Publish failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const rawLength = payload.raw?.length ?? JSON.stringify(payload.blocks).length;
  void recordPublishEvent({
    userId,
    pageId: id,
    isUpdate: false,
    contentLength: rawLength,
    source: "api",
  }).catch((err) => console.error("[v1/publish] event record failed:", err));

  try {
    const fm = frontmatterMeta as import("@/lib/frontmatter").FrontmatterMeta;
    const title = fm.title ?? extractDocTitle(payload.blocks);
    await ensureDbUser(userId, null);
    const plan = await getUserPlan(userId);
    const removeAttributionBadge = canUseFeature(plan, "removeAttributionBadge");
    await createPageRecord(id, userId, title, removeAttributionBadge);

    // Apply frontmatter-derived settings (visibility, slug) where plan allows
    const postPatch: Parameters<typeof updatePageRecord>[1] = {};
    if (fm.visibility) postPatch.visibility = fm.visibility;
    if (fm.slug && canUseFeature(plan, "customSlugs")) postPatch.slug = fm.slug;
    if (Object.keys(postPatch).length > 0) {
      await updatePageRecord(id, postPatch).catch((e) => console.error("[v1/publish] patch failed:", e));
    }

    void snapshotPageVersion(id, doc).catch((err) => {
      console.error("[v1/publish] version snapshot failed:", err);
    });
    void deliverWebhooks(userId, "page.published", {
      page_id: id,
      page_url: `${new URL(req.url).origin}/p/${id}`,
      title,
      published_at: doc.createdAt,
    }).catch(() => {});
  } catch (dbErr) {
    console.error("[v1/publish] DB write failed:", dbErr);
  }

  const url = new URL(req.url);
  url.pathname = ROUTES.publish(id);
  url.search = "";
  url.hash = "";

  return NextResponse.json({ id, url: url.toString() }, { status: 201 });
}
