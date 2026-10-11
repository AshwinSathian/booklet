import { getWebhooksByUser, recordWebhookDelivery, touchWebhookTriggered } from "@/lib/db";
import { logError } from "@/lib/logger";
import { bareHostname, resolveHostForDelivery, pinnedRequest } from "@/lib/ssrf-guard";
import type { DbWebhook, DbWebhookDelivery } from "@/lib/db/types";

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
 * POSTs one delivery over a pinned connection (see pinnedRequest). A
 * receiver that redirects is a failed delivery: the 3xx status is recorded
 * and nothing is followed.
 */
async function requestPinned(
  url: URL,
  address: string,
  family: 4 | 6,
  init: { headers: Record<string, string>; body: string; timeoutMs: number },
): Promise<{ status: number } | { error: string }> {
  try {
    const res = await pinnedRequest(url, address, family, { method: "POST", ...init });
    return { status: res.status };
  } catch (err) {
    // Only a fixed set of words reaches the log the owner reads: a raw
    // socket error could name an address the lookup was steered to.
    return { error: err instanceof Error && /timeout/i.test(err.message) ? "Timed out after 10 seconds" : "Could not connect" };
  }
}

/** Resolves, validates, and returns one already-checked address to connect to. */
async function resolveOneSafeAddress(hostname: string): Promise<{ address: string; family: 4 | 6 } | null> {
  const result = await resolveHostForDelivery(hostname);
  if (!result.safe || result.addresses.length === 0) return null;
  return result.addresses[0];
}

/**
 * Sends one signed body to one webhook and records the attempt in its
 * delivery log. Used for a first delivery and for "Resend", which sends a
 * logged body again and so adds a second row.
 *
 * The hostname is resolved and checked immediately before the request, and
 * the connection goes to that checked address (see pinnedRequest): DNS
 * answers can change between registration and delivery, and between a
 * check and a connection made moments apart.
 */
export async function sendToWebhook(
  webhook: DbWebhook,
  event: WebhookEvent,
  pageId: string,
  body: string,
  // Only a unit spec passes this, to reach a stub on loopback.
  resolve: typeof resolveOneSafeAddress = resolveOneSafeAddress,
): Promise<DbWebhookDelivery> {
  let result: { status: number } | { error: string };
  try {
    const parsed = new URL(webhook.url);
    const safeAddress = await resolve(bareHostname(parsed));
    if (!safeAddress) {
      result = { error: "The URL does not resolve to a public address" };
    } else {
      result = await requestPinned(parsed, safeAddress.address, safeAddress.family, {
        headers: {
          "Content-Type": "application/json",
          "X-Booklet-Signature": `sha256=${await signPayload(webhook.secret, body)}`,
          "X-Booklet-Event": event,
        },
        body,
        timeoutMs: 10_000,
      });
    }
  } catch {
    result = { error: "Could not connect" };
  }

  const status = "status" in result ? result.status : null;
  const delivery: DbWebhookDelivery = {
    id: crypto.randomUUID(),
    webhook_id: webhook.id,
    user_id: webhook.user_id,
    page_id: pageId,
    event,
    body,
    status_code: status,
    ok: status !== null && status >= 200 && status < 300,
    error: "error" in result ? result.error : null,
    created_at: new Date().toISOString(),
  };
  await recordWebhookDelivery(delivery).catch((err) => logError("webhook", "Delivery log write failed", err));
  if (delivery.ok) void touchWebhookTriggered(webhook.id).catch(() => {});
  return delivery;
}

/** Fire-and-forget from the publish and update routes: a failed delivery never fails the request. */
export async function deliverWebhooks(
  userId: string,
  event: WebhookEvent,
  payload: Omit<WebhookPayload, "event">,
) {
  const webhooks = await getWebhooksByUser(userId).catch(() => []);
  const relevant = webhooks.filter((w) => w.events.includes(event));
  if (relevant.length === 0) return;

  const body = JSON.stringify({ event, ...payload });
  await Promise.allSettled(relevant.map((webhook) => sendToWebhook(webhook, event, payload.page_id, body)));
}
