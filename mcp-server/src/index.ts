import { extractApiKey } from "./auth.js";
import { ERRORS, type McpErrorShape } from "./errors.js";
import {
  TOOL_DEFINITIONS,
  handleDeletePage,
  handleGetPage,
  handleListPages,
  handlePublishPage,
  handleResourcesList,
  handleResourcesRead,
  handleUpdatePage,
} from "./tools.js";
import { PROMPT_DEFINITIONS, renderPrompt } from "./prompts.js";
import type {
  Env,
  JsonRpcRequest,
  PromptGetParams,
  ResourceReadParams,
  ToolCallParams,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// MCP Streamable HTTP transport — MCP spec 2025-03-26
// Fully stateless: one POST per request, auth re-validated each time.
// ─────────────────────────────────────────────────────────────────────────────

const PROTOCOL_VERSION = "2025-03-26";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, Mcp-Session-Id",
} as const;

function corsResponse(body: string | null, status: number, extra?: Record<string, string>): Response {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, ...extra },
  });
}

function jsonResponse(data: unknown, status = 200): Response {
  return corsResponse(JSON.stringify(data), status, {
    "Content-Type": "application/json",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Server manifest and capabilities
// ─────────────────────────────────────────────────────────────────────────────

const SERVER_MANIFEST = {
  name: "booklet",
  version: "1.0.0",
  description:
    "Publish, update, read, list, and delete Booklet pages from your AI conversation. Includes pre-built templates for incident reports, ADRs, release notes, RFCs, and runbooks.",
};

const INITIALIZE_RESULT = {
  protocolVersion: PROTOCOL_VERSION,
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
  },
  serverInfo: { name: "booklet", version: "1.0.0" },
};

// ─────────────────────────────────────────────────────────────────────────────
// JSON-RPC helpers
// ─────────────────────────────────────────────────────────────────────────────

function rpcResult(id: string | number | null | undefined, result: unknown) {
  return { jsonrpc: "2.0" as const, id: id ?? null, result };
}

function rpcError(id: string | number | null | undefined, error: McpErrorShape) {
  return { jsonrpc: "2.0" as const, id: id ?? null, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP POST handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleMcpPost(request: Request, env: Env): Promise<Response> {
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return jsonResponse(rpcError(null, ERRORS.UNAUTHORIZED()), 401);
  }

  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonResponse(rpcError(null, ERRORS.PARSE_ERROR()), 200);
  }

  if (typeof body.method !== "string" || body.method === "") {
    return jsonResponse(
      rpcError(body.id, ERRORS.INVALID_REQUEST("method must be a non-empty string")),
      200,
    );
  }

  // MCP notifications — no response, 202 Accepted.
  if (body.method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  let responsePayload: unknown;

  switch (body.method) {
    case "initialize": {
      responsePayload = rpcResult(body.id, INITIALIZE_RESULT);
      break;
    }

    case "ping": {
      responsePayload = rpcResult(body.id, {});
      break;
    }

    // ── Tools ──────────────────────────────────────────────────────────────

    case "tools/list": {
      responsePayload = rpcResult(body.id, { tools: TOOL_DEFINITIONS });
      break;
    }

    case "tools/call": {
      const params = body.params as ToolCallParams | undefined;
      if (!params?.name) {
        responsePayload = rpcError(body.id, ERRORS.INVALID_PARAMS("Missing tool name"));
        break;
      }

      const toolArgs = params.arguments ?? {};
      let toolResult: unknown;

      switch (params.name) {
        case "publish_page":
          toolResult = await handlePublishPage(toolArgs, apiKey, env.BOOKLET_API_BASE);
          break;
        case "update_page":
          toolResult = await handleUpdatePage(toolArgs, apiKey, env.BOOKLET_API_BASE);
          break;
        case "get_page":
          toolResult = await handleGetPage(toolArgs, apiKey, env.BOOKLET_API_BASE);
          break;
        case "list_pages":
          toolResult = await handleListPages(toolArgs, apiKey, env.BOOKLET_API_BASE);
          break;
        case "delete_page":
          toolResult = await handleDeletePage(toolArgs, apiKey, env.BOOKLET_API_BASE);
          break;
        default:
          toolResult = {
            content: [{ type: "text", text: `Error: Unknown tool: ${params.name}` }],
            isError: true,
          };
      }

      responsePayload = rpcResult(body.id, toolResult);
      break;
    }

    // ── Resources ──────────────────────────────────────────────────────────
    // User's Booklet pages are exposed as browsable MCP resources with the
    // URI scheme: booklet://pages/<id>

    case "resources/list": {
      const result = await handleResourcesList(apiKey, env.BOOKLET_API_BASE);
      responsePayload = rpcResult(body.id, result);
      break;
    }

    case "resources/read": {
      const params = body.params as ResourceReadParams | undefined;
      if (!params?.uri) {
        responsePayload = rpcError(body.id, ERRORS.INVALID_PARAMS("Missing resource URI"));
        break;
      }
      const result = await handleResourcesRead(params.uri, apiKey, env.BOOKLET_API_BASE);
      responsePayload = rpcResult(body.id, result);
      break;
    }

    // ── Prompts ────────────────────────────────────────────────────────────
    // Pre-built Markdown templates: incident_report, adr, release_notes, rfc, runbook.
    // Call prompts/get to expand a template, then pass the result to publish_page.

    case "prompts/list": {
      responsePayload = rpcResult(body.id, { prompts: PROMPT_DEFINITIONS });
      break;
    }

    case "prompts/get": {
      const params = body.params as PromptGetParams | undefined;
      if (!params?.name) {
        responsePayload = rpcError(body.id, ERRORS.INVALID_PARAMS("Missing prompt name"));
        break;
      }
      const template = renderPrompt(params.name, params.arguments ?? {});
      if (template === null) {
        responsePayload = rpcError(
          body.id,
          ERRORS.NOT_FOUND(`Prompt "${params.name}"`),
        );
        break;
      }
      responsePayload = rpcResult(body.id, {
        description: PROMPT_DEFINITIONS.find((p) => p.name === params.name)?.description ?? "",
        messages: [
          {
            role: "user",
            content: { type: "text", text: template },
          },
        ],
      });
      break;
    }

    default: {
      responsePayload = rpcError(body.id, ERRORS.METHOD_NOT_FOUND(body.method));
    }
  }

  return jsonResponse(responsePayload);
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker entry point
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      const method = request.method.toUpperCase();

      if (method === "OPTIONS") {
        return corsResponse(null, 204);
      }

      if (method === "GET" && url.pathname === "/health") {
        return jsonResponse({
          ok: true,
          service: "booklet-mcp",
          version: "1.0.0",
          protocol: PROTOCOL_VERSION,
        });
      }

      if (method === "GET" && url.pathname === "/") {
        return jsonResponse({
          ...SERVER_MANIFEST,
          protocol: PROTOCOL_VERSION,
          endpoint: "/mcp",
          tools: TOOL_DEFINITIONS.map((t) => t.name),
          prompts: PROMPT_DEFINITIONS.map((p) => p.name),
        });
      }

      // MCP Streamable HTTP endpoint (2025-03-26)
      if (url.pathname === "/mcp") {
        if (method === "POST") {
          return handleMcpPost(request, env);
        }
        return jsonResponse({ error: "Use POST /mcp for MCP requests" }, 405);
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (e) {
      console.error("Worker unhandled error:", e);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },
};
