/**
 * OAuth clients. Booklet is a public authorization server for MCP clients,
 * so a client is not something an admin creates. It is identified in one of
 * two ways:
 *
 * - A Client ID Metadata Document: the client_id is an https URL, and the
 *   JSON document at that URL lists the client's name and redirect URIs.
 *   Nothing is stored; the document is fetched (through the SSRF guard) and
 *   cached briefly.
 * - Dynamic registration (RFC 7591), for clients that do not publish a
 *   metadata document: POST /api/oauth/register stores the redirect URIs
 *   and returns a generated client_id.
 *
 * Every client is public (no secret). What protects the user is the exact
 * redirect URI match, PKCE, and the consent screen naming where the grant
 * is going.
 */

import https from "node:https";
import { getDb } from "@/lib/mongodb";
import { createId } from "@/lib/id";
import { bareHostname, pinnedLookup, resolveHostForDelivery } from "@/lib/ssrf-guard";

export type OAuthClient = {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  /** How the client is known: a fetched metadata document, or a registration. */
  source: "metadata" | "registered";
};

type ClientDoc = { _id: string; client_name: string | null; redirect_uris: string[]; created_at: string };

const MAX_REDIRECT_URIS = 10;
const MAX_NAME_LENGTH = 100;
const MAX_URI_LENGTH = 2000;

// Schemes that would run code or read local data if a browser followed a
// redirect to them. Everything else that is not http(s) is a private-use
// scheme a native app registered (cursor://, vscode://, …). A denylist and
// not RFC 8252's reverse-DNS allowlist, because the MCP clients in use
// register single-word schemes. A redirect to one only ever happens after
// the signed-in user clicks Allow or Cancel on a screen naming the app.
const FORBIDDEN_SCHEMES = new Set(["javascript:", "data:", "vbscript:", "file:", "blob:", "about:", "ftp:", "ws:", "wss:"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function isLoopback(url: URL): boolean {
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

/** Whether `uri` may be registered as a redirect URI at all. */
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
 * Whether the redirect URI on a request is one the client registered. Exact
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

// ── Dynamic registration ────────────────────────────────────────────────────

const REGISTERED_ID = /^bkc_[0-9A-Za-z]{24}$/;

/** Stores a registration and returns the client, or null if the metadata is not acceptable. */
export async function registerClient(body: unknown): Promise<OAuthClient | null> {
  const meta = cleanMetadata(body);
  if (!meta) return null;
  const client_id = `bkc_${createId(24)}`;
  // ponytail: registrations are never pruned. If the collection grows, add
  // last_used_at and delete clients unused for 90 days.
  await (await getDb())
    .collection<ClientDoc>("oauth_clients")
    .insertOne({ _id: client_id, ...meta, created_at: new Date().toISOString() });
  return { client_id, ...meta, source: "registered" };
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
 * GETs a JSON document over https, connecting only to an address that
 * passed the SSRF denylist (the connection is pinned to it, so DNS cannot
 * answer differently at connect time). No redirects are followed.
 */
function fetchJsonPinned(url: URL, address: string, family: 4 | 6): Promise<unknown> {
  return new Promise((done) => {
    // `timeout` below only fires when the socket goes idle. This is the
    // deadline for the whole exchange, so a server that drips bytes cannot
    // hold the request open.
    const deadline = setTimeout(() => req.destroy(), METADATA_TIMEOUT_MS);
    const resolve = (value: unknown) => {
      clearTimeout(deadline);
      done(value);
    };
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { Host: url.host, Accept: "application/json", "User-Agent": "Booklet-OAuth/1.0" },
        timeout: METADATA_TIMEOUT_MS,
        lookup: pinnedLookup(address, family),
        servername: url.hostname,
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return resolve(null);
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > METADATA_MAX_BYTES) {
            req.destroy();
            return resolve(null);
          }
          chunks.push(c);
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            resolve(null);
          }
        });
        res.on("error", () => resolve(null));
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    req.end();
  });
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
  return meta ? { client_id: url.href, ...meta, source: "metadata" } : null;
}

/** Test seam: replaces the metadata fetch. */
export const metadataFetcher = { fetch: fetchMetadataClient };

/** Looks a client up by its client_id, in whichever of the two forms it is. */
export async function getClient(clientId: unknown): Promise<OAuthClient | null> {
  if (typeof clientId !== "string" || !clientId) return null;

  if (REGISTERED_ID.test(clientId)) {
    const doc = await (await getDb()).collection<ClientDoc>("oauth_clients").findOne({ _id: clientId });
    return doc ? { client_id: doc._id, client_name: doc.client_name, redirect_uris: doc.redirect_uris, source: "registered" } : null;
  }

  const url = isMetadataUrl(clientId);
  if (!url) return null;

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
