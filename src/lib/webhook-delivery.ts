import { getWebhooksByUser, touchWebhookTriggered } from "@/lib/db";
import { bareHostname, resolveHostForDelivery } from "@/lib/ssrf-guard";
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

/**
 * POSTs with `fetch`. A Worker cannot pin a connection to an address it
 * resolved itself (node:http's `lookup` option is not honored there), so
 * the DNS-rebinding defense of the Node build does not carry over. What
 * still holds, and why that is acceptable on Workers, is in the ADR (S5).
 *
 * Never follows redirects: a receiver that 3xx's is a delivery failure.
 */
async function post(
  url: URL,
  init: { headers: Record<string, string>; body: string; timeoutMs: number },
): Promise<{ ok: boolean } | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: init.headers,
      body: init.body,
      redirect: "manual",
      signal: AbortSignal.timeout(init.timeoutMs),
    });
    await res.body?.cancel();
    return { ok: res.ok };
  } catch {
    return null;
  }
}

/** Resolves, validates, and returns one already-checked address to connect to. */
async function resolveOneSafeAddress(hostname: string): Promise<{ address: string; family: 4 | 6 } | null> {
  const result = await resolveHostForDelivery(hostname);
  if (!result.safe || result.addresses.length === 0) return null;
  return result.addresses[0];
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
        // outbound request. On Workers this narrows the window but does not
        // close it: fetch resolves again by itself (see post above).
        let parsed: URL;
        try {
          parsed = new URL(webhook.url);
        } catch {
          return;
        }
        const safeAddress = await resolveOneSafeAddress(bareHostname(parsed));
        if (!safeAddress) return;

        const signature = await signPayload(webhook.secret, body);
        const result = await post(parsed, {
          headers: {
            "Content-Type": "application/json",
            "X-Booklet-Signature": `sha256=${signature}`,
            "X-Booklet-Event": event,
          },
          body,
          timeoutMs: 10_000,
        });
        if (result?.ok) {
          void touchWebhookTriggered(webhook.id).catch(() => {});
        }
      } catch {
        // fire-and-forget; delivery failure is non-fatal
      }
    }),
  );
}
