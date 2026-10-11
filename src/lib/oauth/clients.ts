/**
 * OAuth clients. Booklet is a public authorization server for MCP clients,
 * so a client is not something an admin creates, and nothing about one is
 * stored. A client is identified by a Client ID Metadata Document: its
 * client_id is an https URL, and the JSON document at that URL lists the
 * client's name and redirect URIs. The document is fetched (through the
 * SSRF guard) and cached briefly.
 *
 * Every client is public (no secret). What protects the user is the exact
 * redirect URI match, PKCE, and the consent screen naming where the grant
 * is going.
 */

import { bareHostname, pinnedRequest, resolveHostForDelivery } from "@/lib/ssrf-guard";

export type OAuthClient = {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
};

const MAX_REDIRECT_URIS = 10;
const MAX_NAME_LENGTH = 100;
const MAX_URI_LENGTH = 2000;

// Schemes that would run code or read local data if a browser followed a
// redirect to them. Everything else that is not http(s) is a private-use
// scheme a native app owns (cursor://, vscode://, …). A denylist and
// not RFC 8252's reverse-DNS allowlist, because the MCP clients in use
// have single-word schemes. A redirect to one only ever happens after
// the signed-in user clicks Allow or Cancel on a screen naming the app.
const FORBIDDEN_SCHEMES = new Set(["javascript:", "data:", "vbscript:", "file:", "blob:", "about:", "ftp:", "ws:", "wss:"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function isLoopback(url: URL): boolean {
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

/** Whether `uri` may be one of a client's redirect URIs at all. */
export function isAllowedRedirectUri(uri: unknown): uri is string {
  if (typeof uri !== "string" || uri.length > MAX_URI_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return isLoopback(url); // plain http only to this machine
  return !FORBIDDEN_SCHEMES.has(url.protocol);
}

/**
 * Whether the redirect URI on a request is one the client lists. Exact
 * string match, with the one exception RFC 8252 section 7.3 requires: a
 * loopback URI matches on any port, because native apps listen on whatever
 * port is free.
 */
export function redirectUriMatches(registered: string[], requested: string): boolean {
  if (registered.includes(requested)) return true;
  let req: URL;
  try {
    req = new URL(requested);
  } catch {
    return false;
  }
  if (!isLoopback(req)) return false;
  return registered.some((r) => {
    try {
      const reg = new URL(r);
      return isLoopback(reg) && reg.hostname === req.hostname && reg.pathname === req.pathname && reg.search === req.search;
    } catch {
      return false;
    }
  });
}

function cleanMetadata(body: unknown): { client_name: string | null; redirect_uris: string[] } | null {
  if (!body || typeof body !== "object") return null;
  const { redirect_uris, client_name } = body as Record<string, unknown>;
  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0 || redirect_uris.length > MAX_REDIRECT_URIS) return null;
  if (!redirect_uris.every(isAllowedRedirectUri)) return null;
  return {
    redirect_uris,
    client_name: typeof client_name === "string" && client_name.trim() ? client_name.trim().slice(0, MAX_NAME_LENGTH) : null,
  };
}

// ── Client ID Metadata Documents ────────────────────────────────────────────

const METADATA_TIMEOUT_MS = 5000;
const METADATA_MAX_BYTES = 64 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;
const metadataCache = new Map<string, { client: OAuthClient | null; at: number }>();

/** A client_id that is a metadata document URL: https, with a path, nothing odd. */
function isMetadataUrl(clientId: string): URL | null {
  if (clientId.length > MAX_URI_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(clientId);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hash || url.username || url.password) return null;
  if (url.pathname === "/" || url.href !== clientId) return null; // href !== input catches dot segments and other non-canonical forms
  return url;
}

/**
 * GETs a JSON document over a pinned connection (see pinnedRequest). Null
 * for anything but a 200 with a JSON body under the size cap; a redirect is
 * not followed.
 */
async function fetchJsonPinned(url: URL, address: string, family: 4 | 6): Promise<unknown> {
  try {
    const res = await pinnedRequest(url, address, family, {
      headers: { Accept: "application/json", "User-Agent": "Booklet-OAuth/1.0" },
      timeoutMs: METADATA_TIMEOUT_MS,
      maxBytes: METADATA_MAX_BYTES,
    });
    if (res.status !== 200 || res.truncated) return null;
    return JSON.parse(res.body.toString("utf8"));
  } catch {
    return null;
  }
}

async function fetchMetadataClient(url: URL): Promise<OAuthClient | null> {
  const resolved = await resolveHostForDelivery(bareHostname(url));
  if (!resolved.safe || resolved.addresses.length === 0) return null;
  const { address, family } = resolved.addresses[0];
  const body = await fetchJsonPinned(url, address, family);
  // The document must name itself: otherwise any JSON file on any host
  // that happens to have a redirect_uris key could be used as a client.
  if (!body || typeof body !== "object" || (body as Record<string, unknown>).client_id !== url.href) return null;
  const meta = cleanMetadata(body);
  return meta ? { client_id: url.href, ...meta } : null;
}

let staticSource: string | undefined;
let staticParsed = new Map<string, OAuthClient>();

/**
 * Clients the operator has written into `OAUTH_STATIC_CLIENTS`: a JSON array
 * of metadata documents (`client_id`, `client_name`, `redirect_uris`). One
 * of these is used as written and its URL is never fetched.
 *
 * For an install that cannot reach a client's host, or that would rather
 * not depend on it being up at sign-in; and for the end-to-end tests, whose
 * server has no test seam to swap the fetch through. Each entry passes the
 * same checks a fetched document does. An entry that fails them is dropped.
 */
function staticClients(): Map<string, OAuthClient> {
  const source = process.env.OAUTH_STATIC_CLIENTS;
  if (source === staticSource) return staticParsed;
  staticSource = source;
  staticParsed = new Map();
  if (!source?.trim()) return staticParsed;
  let list: unknown;
  try {
    list = JSON.parse(source);
  } catch {
    return staticParsed;
  }
  for (const entry of Array.isArray(list) ? list : []) {
    const id = entry && typeof entry === "object" ? (entry as Record<string, unknown>).client_id : null;
    const meta = cleanMetadata(entry);
    if (typeof id === "string" && isMetadataUrl(id) && meta) staticParsed.set(id, { client_id: id, ...meta });
  }
  return staticParsed;
}

/** Test seam: replaces the metadata fetch. */
export const metadataFetcher = { fetch: fetchMetadataClient };

/** Looks a client up by its client_id, the URL of its metadata document. */
export async function getClient(clientId: unknown): Promise<OAuthClient | null> {
  if (typeof clientId !== "string" || !clientId) return null;

  const url = isMetadataUrl(clientId);
  if (!url) return null;

  const pinned = staticClients().get(clientId);
  if (pinned) return pinned;

  const cached = metadataCache.get(clientId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.client;
  const client = await metadataFetcher.fetch(url);
  // ponytail: per-process cache, cleared wholesale when full. Failures are
  // cached too, so a broken client cannot make every request refetch.
  if (metadataCache.size >= CACHE_MAX) metadataCache.clear();
  metadataCache.set(clientId, { client, at: Date.now() });
  return client;
}

export function clearClientCache(): void {
  metadataCache.clear();
}
