import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  oauthMetadataResponse,
  requireBearerAuth,
} from "@modelcontextprotocol/server";
import { OAUTH_SCOPES, oauthServerMetadata } from "booklet-api-client";
import { createTokenVerifier } from "./auth.js";
import { isAllowedOrigin } from "./origin.js";
import { createMcpServer, TOOL_NAMES, PROMPT_NAMES, SERVER_VERSION } from "./mcp-server.js";
import type { Env } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// MCP over Streamable HTTP, via @modelcontextprotocol/server.
// Fully stateless: one POST per request, the credential checked each time,
// a fresh McpServer built per call.
// ─────────────────────────────────────────────────────────────────────────────

const SERVER_MANIFEST = {
  name: "booklet",
  version: SERVER_VERSION,
  description:
    "Publish, update, read, list, and delete Booklet pages from your AI conversation. Includes pre-built templates for incident reports, ADRs, release notes, RFCs, and runbooks.",
};

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, *",
    "Access-Control-Expose-Headers": "WWW-Authenticate",
  };
}

function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

/** Per-process wiring: everything derived from the environment, built once. */
function wire(env: Env) {
  const issuer = (env.BOOKLET_PUBLIC_URL ?? "https://booklet.ashwinsathian.com").replace(/\/$/, "");
  const resource = new URL(env.MCP_PUBLIC_URL ?? "https://booklet-mcp.ashwinsathian.com/mcp");
  const metadata = {
    oauthMetadata: oauthServerMetadata(issuer),
    resourceServerUrl: resource,
    scopesSupported: [...OAUTH_SCOPES],
    resourceName: "Booklet",
    serviceDocumentationUrl: new URL(`${issuer}/mcp-setup`),
    // A self-hosted or test deployment may run its app on plain HTTP.
    dangerouslyAllowInsecureIssuerUrl: !issuer.startsWith("https://"),
  };
  return {
    metadata,
    // No credential, a bad one, or a token issued for another resource:
    // 401 with a WWW-Authenticate challenge naming the metadata document,
    // which is how an OAuth client finds out where to sign in.
    gate: requireBearerAuth({
      verifier: createTokenVerifier(env.BOOKLET_API_BASE, resource),
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resource),
      expectedResource: resource,
    }),
    // One factory serves protocol 2026-07-28 and, through the default
    // stateless fallback, 2025-era clients that still send `initialize`.
    handler: createMcpHandler((ctx) => createMcpServer(env.BOOKLET_API_BASE, ctx.authInfo?.token ?? "")),
  };
}

let wired: { env: Env; value: ReturnType<typeof wire> } | undefined;
function wiring(env: Env) {
  if (wired?.env !== env) wired = { env, value: wire(env) };
  return wired.value;
}

function withCors(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

async function handleMcp(request: Request, env: Env, origin: string | null): Promise<Response> {
  const { gate, handler } = wiring(env);
  const auth = await gate(request);
  if (auth instanceof Response) return withCors(auth, origin);
  return withCors(await handler.fetch(request, { authInfo: auth }), origin);
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker entry point
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const method = request.method.toUpperCase();
      const origin = request.headers.get("Origin");

      if (!isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }

      if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(origin) });
      }

      if (method === "GET" && url.pathname === "/health") {
        return jsonResponse({ ok: true, service: "booklet-mcp", version: SERVER_VERSION }, 200, origin);
      }

      if (method === "GET" && url.pathname === "/") {
        return jsonResponse(
          { ...SERVER_MANIFEST, endpoint: "/mcp", tools: TOOL_NAMES, prompts: PROMPT_NAMES },
          200,
          origin,
        );
      }

      // /.well-known/oauth-protected-resource[/mcp] (RFC 9728), plus a copy
      // of the app's authorization server metadata for clients that look
      // for it on this origin.
      const { metadata } = wiring(env);
      const discovery =
        oauthMetadataResponse(request, metadata) ??
        // The same document at the bare well-known path, for clients that
        // do not append the resource's own path.
        (url.pathname === "/.well-known/oauth-protected-resource"
          ? oauthMetadataResponse(new Request(getOAuthProtectedResourceMetadataUrl(metadata.resourceServerUrl), request), metadata)
          : undefined);
      if (discovery) return discovery;

      if (url.pathname === "/mcp") {
        if (method === "POST" || method === "GET" || method === "DELETE") {
          return handleMcp(request, env, origin);
        }
        return jsonResponse({ error: "Use POST, GET, or DELETE on /mcp" }, 405, origin);
      }

      return jsonResponse({ error: "Not found" }, 404, origin);
    } catch (e) {
      console.error("Worker unhandled error:", e);
      return jsonResponse({ error: "Internal server error" }, 500, null);
    }
  },
};
