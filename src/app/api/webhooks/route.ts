import { unverifiedResponse } from "@/server/verification";
import { createWebhook, deleteWebhook, getWebhooksByUser } from "@/lib/db";
import { createId } from "@/lib/id";
import { isUrlSafe } from "@/lib/ssrf-guard";
import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";
import { problem } from "@/server/errors";
import type { DbWebhook } from "@/lib/db/types";

export const runtime = "nodejs";

const ALLOWED_EVENTS = new Set<DbWebhook["events"][number]>(["page.published", "page.updated"]);
const MAX_WEBHOOKS = 5;

export async function GET() {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return problem(401, "Unauthorized");

  const webhooks = await getWebhooksByUser(userId);
  // Never return the secret in list responses
  return NextResponse.json({
    webhooks: webhooks.map(({ secret: _s, ...w }) => w),
  });
}

export async function POST(req: Request) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return problem(401, "Unauthorized");

  const unverified = await unverifiedResponse(userId);
  if (unverified) return unverified;

  let body: { url?: string; events?: unknown[] };
  try {
    body = (await req.json()) as { url?: string; events?: unknown[] };
  } catch {
    return problem(400, "Invalid JSON");
  }

  const url = body.url?.trim();
  if (!url) {
    return problem(422, "Valid HTTPS URL required");
  }
  const urlCheck = await isUrlSafe(url);
  if (!urlCheck.safe) {
    return problem(422, urlCheck.reason);
  }

  const rawEvents = Array.isArray(body.events) ? body.events : ["page.published"];
  const events = rawEvents.filter((e): e is DbWebhook["events"][number] =>
    typeof e === "string" && ALLOWED_EVENTS.has(e as DbWebhook["events"][number])
  );
  if (events.length === 0) {
    return problem(422, "At least one valid event required: page.published, page.updated");
  }

  const existing = await getWebhooksByUser(userId);
  if (existing.length >= MAX_WEBHOOKS) {
    return problem(422, `Maximum ${MAX_WEBHOOKS} webhooks allowed.`);
  }

  const id = createId(10);
  const secret = createId(32); // random signing secret

  await createWebhook(id, userId, url, secret, events);

  // The count-then-insert above isn't atomic: concurrent requests can each
  // pass the check before either one's insert lands, letting a user exceed
  // MAX_WEBHOOKS. Re-count after inserting and compensate by deleting this
  // row if it pushed the user over the limit — bounded overrun (at most the
  // number of truly concurrent requests) instead of unbounded.
  const after = await getWebhooksByUser(userId);
  if (after.length > MAX_WEBHOOKS) {
    await deleteWebhook(id, userId);
    return problem(422, `Maximum ${MAX_WEBHOOKS} webhooks allowed.`);
  }

  return NextResponse.json({ id, url, events, secret }, { status: 201 });
}
