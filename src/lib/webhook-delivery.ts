import http from "node:http";
import https from "node:https";
import { getWebhooksByUser, recordWebhookDelivery, touchWebhookTriggered } from "@/lib/db";
import { logError } from "@/lib/logger";
import { bareHostname, resolveHostForDelivery, pinnedLookup } from "@/lib/ssrf-guard";
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
 * POSTs to a URL while pinning the TCP connection to a specific, already
 * SSRF-validated IP address, using node:http(s) directly instead of `fetch`.
 *
 * `fetch` (undici) does its own independent DNS resolution when it connects
 * — if we validated the hostname with a separate lookup and then handed the
 * URL to `fetch`, an attacker controlling the hostname's DNS could answer
 * the validation lookup with a public IP and the connection's lookup
 * (moments later, low TTL) with an internal one (DNS rebinding). Forcing
 * the actual socket to connect to the address we already checked closes
 * that gap: the Host header / TLS SNI still use the original hostname, only
 * the raw connection target is pinned.
 *
 * Never follows redirects (matches the previous `redirect: "manual"`
 * behavior) — a receiver that 3xx's is treated as a delivery failure.
 */
function requestPinned(
  url: URL,
  address: string,
  family: 4 | 6,
  init: { headers: Record<string, string>; body: string; timeoutMs: number },
): Promise<{ status: number } | { error: string }> {
  return new Promise((resolve) => {
    const isHttps = url.protocol === "https:";
    const mod = isHttps ? https : http;
    let settled = false;
    const done = (result: { status: number } | { error: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const req = mod.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: { ...init.headers, Host: url.host },
        timeout: init.timeoutMs,
        // Pin the connection to the pre-validated address instead of letting
        // Node re-resolve `url.hostname` itself.
        lookup: pinnedLookup(address, family),
        ...(isHttps ? { servername: url.hostname } : {}),
      },
      (res) => {
        res.resume(); // drain the body; we only care about the status
        done({ status: res.statusCode ?? 0 });
      },
    );

    req.on("timeout", () => req.destroy(new Error("Timed out after 10 seconds")));
    // Only a fixed set of words reaches the log the owner reads: a raw
    // socket error could name an address the lookup was steered to.
    req.on("error", (err) => done({ error: /timed out/i.test(err.message) ? "Timed out after 10 seconds" : "Could not connect" }));
    req.end(init.body);
  });
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
 * the connection goes to that checked address (see requestPinned): DNS
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
