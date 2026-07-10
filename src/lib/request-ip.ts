/**
 * Client IP resolution — shared by every route/middleware that makes a
 * security-relevant decision keyed on client IP (rate limits, admin
 * allowlist, analytics dedupe).
 *
 * Production traffic reaches this app exclusively through a Cloudflare
 * Tunnel (cloudflared). When a zone is proxied through Cloudflare, the edge
 * ALWAYS sets `CF-Connecting-IP` itself and overwrites any client-supplied
 * value for that header — it cannot be spoofed on a genuinely-proxied
 * request. `X-Forwarded-For`, by contrast, is appended to (not replaced) by
 * Cloudflare: a client that sends its own fake `X-Forwarded-For` just gets
 * the real IP appended as a later entry, and naive `.split(',')[0]` parsing
 * picks the attacker-controlled first entry. So `x-forwarded-for` must
 * never be trusted for anything security-relevant.
 *
 * If `cf-connecting-ip` is missing — e.g. the tunnel restarted, or a
 * request type (such as a WebSocket upgrade) didn't get the header set, or
 * the origin was somehow reached without going through Cloudflare — we do
 * NOT fall back to any client-controlled header. Instead every such request
 * is bucketed under one fixed sentinel ("unknown"), so spoofing gains an
 * attacker nothing: they can't mint a fresh rate-limit bucket per request
 * just by changing a header, since the bucket key isn't derived from any
 * header they control.
 *
 * In development there is no Cloudflare in front of the app at all, so
 * falling back to `x-forwarded-for` (or a fixed "dev" sentinel) is fine —
 * there's no real security/rate-limit stake locally.
 *
 * Takes a `Headers` object (not a full `Request`) so it can be called from
 * both Route Handlers (`req.headers`) and Server Components, which only have
 * access to `next/headers`' `headers()` result — a `Headers`-compatible
 * object with no enclosing `Request`.
 */
export function getClientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  if (process.env.NODE_ENV === "development") {
    const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return xff || "dev";
  }

  return "unknown";
}
