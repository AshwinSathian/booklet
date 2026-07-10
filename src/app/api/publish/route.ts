import type { PublishedDoc } from "@/lib/blocks";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { BLOCKS, ROUTES, STORAGE } from "@/lib/constants";
import { createPageRecord } from "@/lib/db";
import { ensureDbUser } from "@/lib/db/ensure-user";
import { createId } from "@/lib/id";
import { extractDocTitle } from "@/lib/doc-title";
import { snapshotPageVersion } from "@/lib/db/versions";
import { recordPublishEvent } from "@/lib/db/publish-events";
import { putDoc } from "@/lib/storage";
import { checkRateLimit, checkMonthlyQuota } from "@/lib/rate-limit";
import { ANONYMOUS_LIMITS } from "@/lib/quota";
import { deliverWebhooks } from "@/lib/webhook-delivery";
import { getClientIp } from "@/lib/request-ip";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PublishPayload = {
  blocks: PublishedDoc["blocks"];
  settings?: PublishedDoc["settings"];
  raw?: string;
};

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    // Rate limiting is best-effort — a DB failure must not block publish.
    const rl = await checkRateLimit(`publish__ip__${ip}`, 12).catch(() => null);
    if (rl) return rl;

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

    // Anonymous publishes have no DB "pages" record and no owner, so they're
    // otherwise unbounded — enforce the advertised anonymous quota here,
    // per-IP, rolling calendar month. Gated on `!isAuthenticated` so a
    // signed-in user publishing from the same browser/IP is never subject to
    // this — no double-penalizing, and no risk of an anonymous burst from
    // that IP earlier in the month blocking their authenticated publish.
    if (!isAuthenticated) {
      const quota = await checkMonthlyQuota(
        `publish__ip__${ip}`,
        ANONYMOUS_LIMITS.pagesPerMonth,
        `You've reached the anonymous publishing limit (${ANONYMOUS_LIMITS.pagesPerMonth} pages per month). Sign in for unlimited publishing.`,
      ).catch(() => null);
      if (quota) return quota;
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
      await putDoc(id, doc);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Publish failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const rawLength = payload.raw?.length ?? JSON.stringify(payload.blocks).length;
    void recordPublishEvent({
      userId: userId ?? null,
      pageId: id,
      isUpdate: false,
      contentLength: rawLength,
      source: "browser",
    }).catch((err) => console.error("[publish] event record failed:", err));

    if (isAuthenticated && userId) {
      try {
        const email =
          (sessionClaims?.email as string | undefined) ??
          (sessionClaims?.primary_email_address as string | undefined) ??
          null;
        const title = extractDocTitle(payload.blocks);
        await ensureDbUser(userId, email);
        await createPageRecord(id, userId, title);
        void snapshotPageVersion(id, doc).catch((err) => {
          console.error("[publish] version snapshot failed:", err);
        });
        void deliverWebhooks(userId, "page.published", {
          page_id: id,
          page_url: `${new URL(req.url).origin}/p/${id}`,
          title,
          published_at: doc.createdAt,
        }).catch(() => {});
      } catch (dbErr) {
        console.error("[publish] DB ownership write failed:", dbErr);
      }
    }

    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
      : new URL(req.url).origin;
    const publishedUrl = `${siteOrigin}${ROUTES.publish(id)}`;

    return NextResponse.json({
      id,
      url: publishedUrl,
      owned: isAuthenticated,
    });
  } catch (e: unknown) {
    console.error("[publish] Unhandled error:", e);
    const msg = e instanceof Error ? e.message : "An unexpected error occurred";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
