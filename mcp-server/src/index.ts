import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { extractApiKey } from "./auth.js";
import { isAllowedOrigin } from "./origin.js";
import { createMcpServer, TOOL_NAMES, PROMPT_NAMES } from "./mcp-server.js";
import { ERRORS } from "./errors.js";
import type { Env } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// MCP Streamable HTTP transport, via @modelcontextprotocol/sdk.
// Fully stateless: one POST per request, auth re-validated each time, a
// fresh McpServer+transport built per call — matches the SDK's documented
// stateless deployment pattern for horizontally-scaled remote servers.
// ─────────────────────────────────────────────────────────────────────────────

const SERVER_MANIFEST = {
  name: "booklet",
  version: "2.0.0",
  description:
    "Publish, update, read, list, and delete Booklet pages from your AI conversation. Includes pre-built templates for incident reports, ADRs, release notes, RFCs, and runbooks.",
};

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Protocol-Version",
  };
}

function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

async function handleMcp(request: Request, env: Env, origin: string | null): Promise<Response> {
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return jsonResponse({ jsonrpc: "2.0", id: null, error: ERRORS.UNAUTHORIZED() }, 401, origin);
  }

  const server = createMcpServer(env.BOOKLET_API_BASE, apiKey);
  // Omitting sessionIdGenerator (rather than setting it to `undefined`) is
  // what puts the transport in stateless mode — this workspace's tsconfig
  // has exactOptionalPropertyTypes: true, which disallows explicitly
  // assigning `undefined` to an optional property.
  const transport = new WebStandardStreamableHTTPServerTransport({});
  await server.connect(transport);

  const response = await transport.handleRequest(request, {
    authInfo: { token: apiKey, clientId: apiKey, scopes: [] },
  });

  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
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
        return jsonResponse({ ok: true, service: "booklet-mcp", version: "2.0.0" }, 200, origin);
      }

      if (method === "GET" && url.pathname === "/") {
        return jsonResponse(
          { ...SERVER_MANIFEST, endpoint: "/mcp", tools: TOOL_NAMES, prompts: PROMPT_NAMES },
          200,
          origin,
        );
      }

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
