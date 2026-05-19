import { getWebhooksByUser, touchWebhookTriggered } from "@/lib/db";
import type { DbWebhook } from "@/lib/db/types";

type WebhookEvent = DbWebhook["events"][number];

type WebhookPayload = {
  event: WebhookEvent;
  page_id: string;
  page_url: string;
  title: string | null;
  published_at: string;
};

async function signPayload(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function deliverWebhooks(
  userId: string,
  event: WebhookEvent,
  payload: Omit<WebhookPayload, "event">,
) {
  const webhooks = await getWebhooksByUser(userId).catch(() => []);
  const relevant = webhooks.filter((w) => w.events.includes(event));
  if (relevant.length === 0) return;

  const body = JSON.stringify({ event, ...payload });

  await Promise.allSettled(
    relevant.map(async (webhook) => {
      const signature = await signPayload(webhook.secret, body);
      try {
        const res = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Readable-Signature": `sha256=${signature}`,
            "X-Readable-Event": event,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) {
          void touchWebhookTriggered(webhook.id).catch(() => {});
        }
      } catch {
        // fire-and-forget; delivery failure is non-fatal
      }
    }),
  );
}
