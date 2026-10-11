import http from "node:http";
import https from "node:https";
import { promises as dns } from "node:dns";
import net from "node:net";

/**
 * Shared SSRF defenses for anything that lets a user register a URL that
 * the server will later fetch on their behalf (webhooks today).
 *
 * Used both:
 *  - at creation/update time, to reject URLs that point at internal
 *    infrastructure, and
 *  - at delivery time, immediately before the outbound fetch, to defend
 *    against DNS rebinding (a hostname that resolved to a public IP when it
 *    was registered but resolves to an internal IP by the time we deliver).
 *
 * This is a denylist of non-routable / internal ranges, not an allowlist —
 * ordinary public webhook endpoints are unaffected.
 */

const BLOCKED_IPV4_CIDRS = [
  "0.0.0.0/8", // "this network" / unspecified
  "10.0.0.0/8", // RFC1918 private
  "100.64.0.0/10", // CGNAT shared address space
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local (covers the 169.254.169.254 cloud metadata address)
  "172.16.0.0/12", // RFC1918 private
  "192.168.0.0/16", // RFC1918 private
];

const BLOCKED_IPV6_CIDRS = [
  "::1/128", // loopback
  "fc00::/7", // unique local (ULA)
  "fe80::/10", // link-local
];

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const val = Number(part);
    if (val < 0 || val > 255) return null;
    n = (n << 8) | val;
  }
  return n >>> 0;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const ipLong = ipv4ToLong(ip);
  const rangeLong = ipv4ToLong(range);
  if (ipLong === null || rangeLong === null) return false;
  if (bits === 0) return true;
  const mask = bits >= 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (ipLong & mask) >>> 0 === (rangeLong & mask) >>> 0;
}

/** Parses any valid textual IPv6 address (including embedded IPv4, e.g. `::ffff:127.0.0.1`) into a 128-bit BigInt. */
function ipv6ToBigInt(ip: string): bigint | null {
  let address = ip;
  const pct = address.indexOf("%");
  if (pct !== -1) address = address.slice(0, pct); // strip zone index, e.g. fe80::1%eth0

  // Embedded IPv4 tail, e.g. "::ffff:127.0.0.1" or "::127.0.0.1"
  const lastSegStart = address.lastIndexOf(":") + 1;
  const lastSeg = address.slice(lastSegStart);
  if (lastSeg.includes(".")) {
    const v4 = ipv4ToLong(lastSeg);
    if (v4 === null) return null;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    address = address.slice(0, lastSegStart) + hi + ":" + lo;
  }

  let groups: string[];
  const dcIdx = address.indexOf("::");
  if (dcIdx !== -1) {
    const left = address
      .slice(0, dcIdx)
      .split(":")
      .filter((s) => s.length > 0);
    const right = address
      .slice(dcIdx + 2)
      .split(":")
      .filter((s) => s.length > 0);
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    groups = [...left, ...Array(missing).fill("0"), ...right];
  } else {
    groups = address.split(":");
  }
  if (groups.length !== 8) return null;

  let result = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    result = (result << 16n) | BigInt(parseInt(g, 16));
  }
  return result;
}

function ipv6InCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = BigInt(Number(bitsStr));
  const ipBig = ipv6ToBigInt(ip);
  const rangeBig = ipv6ToBigInt(range);
  if (ipBig === null || rangeBig === null) return false;
  const shift = 128n - bits;
  const full = (1n << 128n) - 1n;
  const mask = shift === 0n ? full : (full >> shift) << shift;
  return (ipBig & mask) === (rangeBig & mask);
}

function bigIntLow32ToDottedIpv4(big: bigint): string {
  const low = big & 0xffffffffn;
  return [
    (low >> 24n) & 0xffn,
    (low >> 16n) & 0xffn,
    (low >> 8n) & 0xffn,
    low & 0xffn,
  ].join(".");
}

/** Returns true if `ip` (a literal IPv4 or IPv6 address) falls in a blocked internal/non-routable range. */
export function isBlockedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    return BLOCKED_IPV4_CIDRS.some((cidr) => ipv4InCidr(ip, cidr));
  }
  if (version === 6) {
    const big = ipv6ToBigInt(ip);
    if (big === null) return true; // unparsable -> fail closed

    // IPv4-mapped (::ffff:a.b.c.d) or IPv4-compatible (::a.b.c.d, deprecated)
    // addresses smuggle an IPv4 address inside an IPv6 literal; check that
    // embedded address against the IPv4 denylist too.
    if (big >> 32n === 0xffffn || big >> 32n === 0n) {
      const embedded = bigIntLow32ToDottedIpv4(big);
      if (BLOCKED_IPV4_CIDRS.some((cidr) => ipv4InCidr(embedded, cidr))) return true;
    }

    return BLOCKED_IPV6_CIDRS.some((cidr) => ipv6InCidr(ip, cidr));
  }
  // Not a valid IP literal at all -> fail closed.
  return true;
}

/** Strips the `[...]` brackets the URL API puts around an IPv6 literal hostname. */
export function bareHostname(url: URL): string {
  return url.hostname.replace(/^\[/, "").replace(/\]$/, "");
}

export type HostCheckResult = { safe: true } | { safe: false; reason: string };

/**
 * Resolves `hostname` and checks every returned address against the
 * denylist. Rejects if *any* resolved address (not just the first) falls in
 * a blocked range.
 *
 * This alone is NOT sufficient DNS-rebinding protection for delivery: it
 * only tells you the hostname resolved safely *at the moment of this call*.
 * If the caller then does its own separate lookup to connect (e.g. a plain
 * `fetch(url)`), an attacker controlling the hostname's DNS can answer this
 * check with a public IP and the connection's lookup — moments later, with
 * a near-zero TTL — with an internal one. Use `resolveHostForDelivery`
 * instead when you're about to make the outbound request, so the same
 * validated address is what the connection actually uses.
 */
export async function resolveHostSafely(hostname: string): Promise<HostCheckResult> {
  const result = await resolveHostForDelivery(hostname);
  return result.safe ? { safe: true } : result;
}

export type HostResolveResult =
  | { safe: true; addresses: { address: string; family: 4 | 6 }[] }
  | { safe: false; reason: string };

/**
 * Resolves `hostname`, validates every returned address against the
 * denylist, and returns the validated addresses themselves. Callers making
 * an outbound request MUST connect directly to one of these addresses
 * (e.g. via a pinned `lookup`) rather than letting the HTTP client re-resolve
 * the hostname — otherwise the check-time and connect-time resolutions are
 * two separate DNS answers, which a DNS-rebinding attacker can exploit by
 * returning a safe address for the check and an internal one for the
 * connection.
 */
export async function resolveHostForDelivery(hostname: string): Promise<HostResolveResult> {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) {
    return { safe: false, reason: "localhost is not allowed" };
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      return { safe: false, reason: "URL resolves to a blocked internal address" };
    }
    const family = net.isIP(hostname) as 4 | 6;
    return { safe: true, addresses: [{ address: hostname, family }] };
  }

  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    return { safe: false, reason: "Could not resolve hostname" };
  }

  if (records.length === 0) {
    return { safe: false, reason: "Could not resolve hostname" };
  }
  if (records.some((r) => isBlockedIp(r.address))) {
    return { safe: false, reason: "URL resolves to a blocked internal address" };
  }
  return {
    safe: true,
    addresses: records.map((r) => ({ address: r.address, family: r.family === 6 ? 6 : 4 })),
  };
}

export type UrlCheckResult = { safe: true; url: URL } | { safe: false; reason: string };

/**
 * Full validation for a user-supplied webhook URL: scheme check + hostname
 * resolution + denylist check. Use at creation/update time. Use
 * `resolveHostSafely` directly at delivery time (the scheme was already
 * validated at creation, and re-running `new URL()` there is cheap anyway,
 * but this is the one-stop entry point for "is this URL ok to register").
 */
export async function isUrlSafe(rawUrl: string): Promise<UrlCheckResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "Invalid URL" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { safe: false, reason: "Only http/https URLs are allowed" };
  }

  const result = await resolveHostSafely(bareHostname(url));
  if (!result.safe) return result;
  return { safe: true, url };
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | { address: string; family: number }[], family?: number) => void;

/**
 * A `lookup` for node:http(s) that answers every hostname with one address
 * that already passed the denylist, so the connection cannot be steered by
 * a second DNS answer.
 *
 * Node 20 and later call `lookup` with `{ all: true }` and expect an array
 * of addresses back; older callers expect one address and its family. A
 * lookup that only gives the second form fails every request with
 * ERR_INVALID_IP_ADDRESS.
 */
export function pinnedLookup(address: string, family: 4 | 6) {
  return (_hostname: string, options: { all?: boolean }, callback: LookupCallback): void => {
    if (options?.all) callback(null, [{ address, family }]);
    else callback(null, address, family);
  };
}

export type PinnedResponse = { status: number; location: string | null; contentType: string; body: Buffer; truncated: boolean };

/**
 * One HTTP request with the TCP connection pinned to an address that has
 * already passed the denylist (`resolveHostForDelivery`), using node:http(s)
 * and not `fetch`.
 *
 * `fetch` resolves the hostname again when it connects. Had the hostname
 * been checked with a separate lookup first, whoever controls its DNS could
 * answer the check with a public address and the connection's lookup,
 * moments later, with an internal one (DNS rebinding). Here the socket goes
 * to the checked address; the Host header and TLS server name still carry
 * the hostname.
 *
 * - Never follows a redirect: `location` is returned for the caller to refuse.
 * - `timeoutMs` bounds the whole exchange, not only idle time, so a server
 *   that drips bytes cannot hold the request open.
 * - `maxBytes` caps the body kept. Past it, reading stops and `truncated`
 *   is true. With 0 (the default) the body is not read: the promise
 *   settles when the status line arrives and the connection is closed.
 *
 * Rejects on a connection error or timeout. The error's message can name
 * the address connected to: callers show their own words, not it.
 *
 * Every outbound request to a user-supplied host goes through here: webhook
 * delivery, import from URL, and OAuth client metadata documents.
 */
export function pinnedRequest(
  url: URL,
  address: string,
  family: 4 | 6,
  init: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string; timeoutMs: number; maxBytes?: number },
): Promise<PinnedResponse> {
  const maxBytes = init.maxBytes ?? 0;
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const deadline = setTimeout(() => req.destroy(new Error("timeout")), init.timeoutMs);
    const settle = <T>(fn: (value: T) => void) => (value: T) => {
      clearTimeout(deadline);
      fn(value);
    };
    const ok = settle(resolve);
    const fail = settle(reject);

    const req = (isHttps ? https : http).request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: init.method ?? "GET",
        headers: { ...init.headers, Host: url.host },
        timeout: init.timeoutMs,
        lookup: pinnedLookup(address, family),
        ...(isHttps ? { servername: url.hostname } : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        const finish = (truncated: boolean) =>
          ok({
            status: res.statusCode ?? 0,
            location: typeof res.headers.location === "string" ? res.headers.location : null,
            contentType: String(res.headers["content-type"] ?? ""),
            body: Buffer.concat(chunks),
            truncated,
          });
        if (maxBytes === 0) {
          // The status is all that is wanted. Closing here, and not
          // draining, means a body that never ends cannot hold the socket.
          finish(false);
          req.destroy();
          return;
        }
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            // Stop reading: the answer is "too large" whatever follows.
            finish(true);
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => finish(false));
        res.on("error", fail);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", fail);
    req.end(init.body);
  });
}
