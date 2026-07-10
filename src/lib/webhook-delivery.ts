import { getWebhooksByUser, touchWebhookTriggered } from "@/lib/db";
import { bareHostname, resolveHostSafely } from "@/lib/ssrf-guard";
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
      try {
        // Re-resolve and re-check the hostname immediately before the
        // outbound request. The URL passed creation-time validation, but
        // DNS answers can change afterwards (DNS rebinding) — a hostname
        // that resolved to a public IP when the webhook was registered
        // could resolve to an internal address by the time we deliver.
        let parsed: URL;
        try {
          parsed = new URL(webhook.url);
        } catch {
          return;
        }
        const check = await resolveHostSafely(bareHostname(parsed));
        if (!check.safe) return;

        const signature = await signPayload(webhook.secret, body);
        const res = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Readable-Signature": `sha256=${signature}`,
            "X-Readable-Event": event,
          },
          body,
          // Never follow redirects for webhook delivery: a legitimate
          // receiver doesn't need us to, and following one blindly would
          // let a URL that passed the denylist check redirect us to an
          // internal address at delivery time. A 3xx response is treated
          // as a delivery failure (res.ok is false for it).
          redirect: "manual",
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
