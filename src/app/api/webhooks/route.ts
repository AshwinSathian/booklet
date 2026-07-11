import { createWebhook, getWebhooksByUser } from "@/lib/db";
import { createId } from "@/lib/id";
import { isUrlSafe } from "@/lib/ssrf-guard";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";
import type { DbWebhook } from "@/lib/db/types";

export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set<DbWebhook["events"][number]>(["page.published", "page.updated"]);
const MAX_WEBHOOKS = 5;

export async function GET() {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const webhooks = await getWebhooksByUser(userId);
  // Never return the secret in list responses
  return NextResponse.json({
    webhooks: webhooks.map(({ secret: _s, ...w }) => w),
  });
}

export async function POST(req: Request) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { url?: string; events?: unknown[] };
  try {
    body = (await req.json()) as { url?: string; events?: unknown[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Valid HTTPS URL required" }, { status: 422 });
  }
  const urlCheck = await isUrlSafe(url);
  if (!urlCheck.safe) {
    return NextResponse.json({ error: urlCheck.reason }, { status: 422 });
  }

  const rawEvents = Array.isArray(body.events) ? body.events : ["page.published"];
  const events = rawEvents.filter((e): e is DbWebhook["events"][number] =>
    typeof e === "string" && ALLOWED_EVENTS.has(e as DbWebhook["events"][number])
  );
  if (events.length === 0) {
    return NextResponse.json({ error: "At least one valid event required: page.published, page.updated" }, { status: 422 });
  }

  const existing = await getWebhooksByUser(userId);
  if (existing.length >= MAX_WEBHOOKS) {
    return NextResponse.json({ error: `Maximum ${MAX_WEBHOOKS} webhooks allowed.` }, { status: 422 });
  }

  const id = createId(10);
  const secret = createId(32); // random signing secret

  await createWebhook(id, userId, url, secret, events);

  return NextResponse.json({ id, url, events, secret }, { status: 201 });
}
