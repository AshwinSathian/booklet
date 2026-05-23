import { extractApiKey } from "./auth.js";
import { ERRORS, type McpErrorShape } from "./errors.js";
import { sseEvent, startKeepalive } from "./transport.js";
import {
  TOOL_DEFINITIONS,
  handleDeletePage,
  handleListPages,
  handlePublishPage,
  handleUpdatePage,
} from "./tools.js";
import type { Env, JsonRpcRequest, Session, ToolCallParams } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// In-memory session store
// ─────────────────────────────────────────────────────────────────────────────

const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function cleanStaleSessions(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.lastActivity < cutoff) {
      sessions.delete(id);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORS headers
// ─────────────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
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
// MCP manifest
// ─────────────────────────────────────────────────────────────────────────────

const SERVER_MANIFEST = {
  name: "readable",
  version: "1.0.0",
  description:
    "Publish, update, list, and delete Readable pages from your AI conversation.",
  tools: TOOL_DEFINITIONS,
};

const INITIALIZE_RESULT = {
  protocolVersion: "2024-11-05",
  capabilities: { tools: {} },
  serverInfo: { name: "readable", version: "1.0.0" },
};

// ─────────────────────────────────────────────────────────────────────────────
// JSON-RPC response builders
// ─────────────────────────────────────────────────────────────────────────────

function rpcResult(id: string | number | null | undefined, result: unknown) {
  // Per JSON-RPC 2.0 spec, id must be present in responses. When id is
  // undefined (e.g. from a malformed request), fall back to null.
  return { jsonrpc: "2.0" as const, id: id ?? null, result };
}

// Per JSON-RPC 2.0 spec, error response id must be null when the request id
// cannot be determined (parse error, invalid request). Never substitute 0.
function rpcError(id: string | number | null | undefined, error: McpErrorShape) {
  return { jsonrpc: "2.0" as const, id: id ?? null, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────────────────────

function handleHealth(): Response {
  return jsonResponse({ ok: true, service: "readable-mcp", version: "1.0.0" });
}

function handleInfo(): Response {
  return jsonResponse(SERVER_MANIFEST);
}

function handleSse(request: Request): Response {
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return jsonResponse(
      { error: "Missing or invalid API key. Use Authorization: Bearer rdbl_live_..." },
      401,
    );
  }

  cleanStaleSessions();

  const sessionId = generateSessionId();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const session: Session = {
        id: sessionId,
        apiKey,
        controller,
        lastActivity: Date.now(),
      };
      sessions.set(sessionId, session);

      const cancelKeepalive = startKeepalive(controller, encoder);

      controller.enqueue(
        encoder.encode(sseEvent("endpoint", `/message?sessionId=${sessionId}`)),
      );
      controller.enqueue(
        encoder.encode(
          sseEvent(
            "connected",
            JSON.stringify({ server: SERVER_MANIFEST.name, version: SERVER_MANIFEST.version }),
          ),
        ),
      );

      // Clean up session when stream closes
      request.signal.addEventListener("abort", () => {
        cancelKeepalive();
        sessions.delete(sessionId);
      });
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function handleMessage(request: Request, apiBase: string): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return jsonResponse({ error: "Missing sessionId query parameter" }, 400);
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return jsonResponse({ error: "Session not found or expired" }, 404);
  }

  session.lastActivity = Date.now();

  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    // id is indeterminate on parse failure — must be null per JSON-RPC spec
    sendSseMessage(session, rpcError(null, ERRORS.PARSE_ERROR()));
    return jsonResponse({ ok: true });
  }

  // Runtime guard: method must be a non-empty string. The `as JsonRpcRequest`
  // cast is unsafe — the client can send anything.
  if (typeof body.method !== "string" || body.method === "") {
    sendSseMessage(session, rpcError(body.id, ERRORS.INVALID_REQUEST("method must be a non-empty string")));
    return jsonResponse({ ok: true });
  }

  // MCP notifications have no id and expect no response. Handle them first.
  if (body.id === undefined || body.id === null) {
    if (body.method === "notifications/initialized" || body.method.startsWith("notifications/")) {
      // Silently acknowledge — notifications never get a response
      return jsonResponse({ ok: true });
    }
  }

  let responsePayload: unknown;

  switch (body.method) {
    case "initialize": {
      responsePayload = rpcResult(body.id, INITIALIZE_RESULT);
      break;
    }

    case "ping": {
      // Keepalive probe — respond with empty result per MCP spec
      responsePayload = rpcResult(body.id, {});
      break;
    }

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
          toolResult = await handlePublishPage(toolArgs, session.apiKey, apiBase);
          break;
        case "update_page":
          toolResult = await handleUpdatePage(toolArgs, session.apiKey, apiBase);
          break;
        case "list_pages":
          toolResult = await handleListPages(toolArgs, session.apiKey, apiBase);
          break;
        case "delete_page":
          toolResult = await handleDeletePage(toolArgs, session.apiKey, apiBase);
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

    default: {
      responsePayload = rpcError(body.id, ERRORS.METHOD_NOT_FOUND(body.method));
    }
  }

  sendSseMessage(session, responsePayload);
  return jsonResponse({ ok: true });
}

function sendSseMessage(session: Session, payload: unknown): void {
  try {
    const encoder = new TextEncoder();
    session.controller.enqueue(
      encoder.encode(sseEvent("message", JSON.stringify(payload))),
    );
  } catch (e) {
    console.error("Failed to send SSE message to session", session.id, e);
  }
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
        return handleHealth();
      }

      if (method === "GET" && url.pathname === "/") {
        return handleInfo();
      }

      if (method === "GET" && url.pathname === "/sse") {
        return handleSse(request);
      }

      if (method === "POST" && url.pathname === "/message") {
        return handleMessage(request, env.READABLE_API_BASE);
      }

      return jsonResponse({ error: "Not found" }, 404);
    } catch (e) {
      console.error("Worker unhandled error:", e);
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
