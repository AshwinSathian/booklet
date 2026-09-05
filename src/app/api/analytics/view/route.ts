import { getDb } from "@/lib/mongodb";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { hashSession } from "@/lib/session-hash";
import { logError } from "@/lib/logger";
import type { AnalyticsEvent } from "@/lib/db/types";

export const runtime = "nodejs";

type AnalyticsPayload = {
  pageId?: string;
  event?: AnalyticsEvent["event"];
  referrer?: string;
};

const ALLOWED_EVENTS = new Set<AnalyticsEvent["event"]>(["view", "read_50", "read_100", "cta_click"]);

function bucketReferrer(ref: string): AnalyticsEvent["referrer_bucket"] {
  const value = ref.toLowerCase();
  if (!value) return "direct";
  if (value.includes("slack.com") || value.includes("slack-edge.com")) return "slack";
  if (value.includes("twitter.com") || value.includes("t.co") || value.includes("x.com")) return "twitter";
  if (value.includes("github.com") || value.includes("github.io")) return "github";
  if (value.includes("mail.google") || value.includes("mail.yahoo") || value.includes("outlook")) return "email";
  return "other";
}

export async function POST(req: Request) {
  let body: AnalyticsPayload;
  try {
    body = (await req.json()) as AnalyticsPayload;
  } catch {
    return new Response(null, { status: 204 });
  }

  if (
    typeof body.pageId !== "string" ||
    !body.pageId ||
    typeof body.event !== "string" ||
    !ALLOWED_EVENTS.has(body.event) ||
    (body.referrer !== undefined && typeof body.referrer !== "string")
  ) {
    // Reject anything that isn't a plain string here — pageId/event flow
    // straight into a Mongo filter below, and an object like
    // `{"$ne": null}` would otherwise become a query operator instead of an
    // equality match (NoSQL injection).
    return new Response(null, { status: 204 });
  }

  const ip = getClientIp(req.headers);
  const rl = await checkRateLimit(`analytics__${ip}`, 100).catch(() => null);
  if (rl) return new Response(null, { status: 204 });

  const sessionHash = await hashSession(ip, req.headers.get("user-agent") ?? "");
  const country = req.headers.get("cf-ipcountry") || null;

  try {
    const db = await getDb();
    await db.collection<AnalyticsEvent>("analytics_events").updateOne(
      {
        session_hash: sessionHash,
        page_id: body.pageId,
        event: body.event,
      },
      {
        $setOnInsert: {
          id: crypto.randomUUID(),
          page_id: body.pageId,
          event: body.event,
          referrer_bucket: bucketReferrer(body.referrer ?? ""),
          country,
          session_hash: sessionHash,
          created_at: new Date().toISOString(),
          // Separate BSON Date field for the TTL index — Mongo's TTL monitor
          // only expires documents whose indexed field is a real Date, and
          // `created_at` is deliberately kept as an ISO string everywhere in
          // this codebase for display/range-query consistency.
          expires_at: new Date(),
        },
      },
      { upsert: true },
    );
  } catch (err) {
    logError("analytics", "Event write failed", err);
  }

  return new Response(null, { status: 204 });
}
