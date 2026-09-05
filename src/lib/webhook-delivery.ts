import http from "node:http";
import https from "node:https";
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
): Promise<{ ok: boolean } | null> {
  return new Promise((resolve) => {
    const isHttps = url.protocol === "https:";
    const mod = isHttps ? https : http;
    let settled = false;
    const done = (result: { ok: boolean } | null) => {
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
        lookup: (_hostname, _options, callback) => {
          callback(null, address, family);
        },
        ...(isHttps ? { servername: url.hostname } : {}),
      },
      (res) => {
        res.resume(); // drain the body; we only care about the status
        const status = res.statusCode ?? 0;
        done({ ok: status >= 200 && status < 300 });
      },
    );

    req.on("timeout", () => req.destroy(new Error("Webhook delivery timed out")));
    req.on("error", () => done(null));
    req.end(init.body);
  });
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
        // outbound request, then connect directly to the validated address
        // (see requestPinned) rather than letting a separate resolution
        // happen at connect time — DNS answers can change between
        // registration and delivery (rebinding), and can just as easily
        // change between a validation lookup and a connection lookup done
        // moments apart, so "check, then let something else re-resolve and
        // connect" is not actually closed by re-checking alone.
        let parsed: URL;
        try {
          parsed = new URL(webhook.url);
        } catch {
          return;
        }
        const safeAddress = await resolveOneSafeAddress(bareHostname(parsed));
        if (!safeAddress) return;

        const signature = await signPayload(webhook.secret, body);
        const result = await requestPinned(parsed, safeAddress.address, safeAddress.family, {
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
