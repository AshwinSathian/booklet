import { getDb } from "@/lib/mongodb";
import { checkRateLimit } from "@/lib/rate-limit";
import type { AnalyticsEvent } from "@/lib/db/types";

export const runtime = "nodejs";

type AnalyticsPayload = {
  pageId?: string;
  event?: AnalyticsEvent["event"];
  referrer?: string;
};

const ALLOWED_EVENTS = new Set<AnalyticsEvent["event"]>(["view", "read_50", "read_100"]);

function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;

  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";

  return "unknown";
}

function bucketReferrer(ref: string): AnalyticsEvent["referrer_bucket"] {
  const value = ref.toLowerCase();
  if (!value) return "direct";
  if (value.includes("slack.com") || value.includes("slack-edge.com")) return "slack";
  if (value.includes("twitter.com") || value.includes("t.co") || value.includes("x.com")) return "twitter";
  if (value.includes("github.com") || value.includes("github.io")) return "github";
  if (value.includes("mail.google") || value.includes("mail.yahoo") || value.includes("outlook")) return "email";
  return "other";
}

async function hashSession(input: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: Request) {
  let body: AnalyticsPayload;
  try {
    body = (await req.json()) as AnalyticsPayload;
  } catch {
    return new Response(null, { status: 204 });
  }

  if (!body.pageId || !body.event || !ALLOWED_EVENTS.has(body.event)) {
    return new Response(null, { status: 204 });
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit(`analytics__${ip}`, 100).catch(() => null);
  if (rl) return new Response(null, { status: 204 });

  const today = new Date().toISOString().slice(0, 10);
  const sessionHash = await hashSession(`${ip}|${req.headers.get("user-agent") ?? ""}|${today}`);
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
        },
      },
      { upsert: true },
    );
  } catch (err) {
    console.error("[analytics] event write failed:", err);
  }

  return new Response(null, { status: 204 });
}
