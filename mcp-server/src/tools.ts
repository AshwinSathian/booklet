import { ERRORS, McpValidationError, type McpErrorShape } from "./errors.js";
import type { PageListItem, PublishResponse, UpdateResponse } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions (JSON Schema)
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: "publish_page",
    description:
      "Publish a new Readable page from Markdown text. Returns a public URL that can be shared immediately. The page is permanent and associated with your Readable account.",
    inputSchema: {
      type: "object",
      properties: {
        raw: {
          type: "string",
          description:
            "Markdown content to publish. Max 350,000 characters. Supports GFM: headings, bold, italic, code blocks, tables, blockquotes, lists, links, Mermaid diagrams.",
        },
        title: {
          type: "string",
          description: "Override the page title. If omitted, Readable extracts the first H1.",
        },
      },
      required: ["raw"],
    },
  },
  {
    name: "update_page",
    description:
      "Update the content of an existing Readable page you own. The URL stays the same — visitors who already have the link will see the new content. Use list_pages to find page IDs.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description:
            'The page ID (e.g. "Ab3k91QxZp") or custom slug. Obtain from publish_page or list_pages.',
        },
        raw: {
          type: "string",
          description: "New Markdown content. Replaces the existing content entirely.",
        },
      },
      required: ["id", "raw"],
    },
  },
  {
    name: "list_pages",
    description:
      "List all Readable pages owned by your account. Returns page IDs, titles, URLs, view counts, and visibility status. Use this to find page IDs for update_page or delete_page.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum pages to return. Default 20, max 50.",
        },
      },
      required: [],
    },
  },
  {
    name: "delete_page",
    description:
      "Permanently delete a Readable page. This cannot be undone and the URL will stop working immediately. Visitors who already have the link will see a 404. Use list_pages to confirm the correct page ID before deleting.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The page ID to delete.",
        },
        confirm: {
          type: "boolean",
          description: "Must be true to proceed. This prevents accidental deletion.",
        },
      },
      required: ["id", "confirm"],
    },
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Input validation
// ─────────────────────────────────────────────────────────────────────────────

function validatePublishArgs(args: unknown): { raw: string; title?: string } {
  if (typeof args !== "object" || args === null) {
    throw new McpValidationError("Arguments must be an object");
  }
  const a = args as Record<string, unknown>;
  if (typeof a["raw"] !== "string" || a["raw"].trim().length === 0) {
    throw new McpValidationError("`raw` must be a non-empty string");
  }
  if (a["raw"].length > 350_000) {
    throw new McpValidationError("`raw` exceeds 350,000 character limit");
  }
  if (a["title"] !== undefined && typeof a["title"] !== "string") {
    throw new McpValidationError("`title` must be a string if provided");
  }
  if (a["title"] !== undefined) {
    return { raw: a["raw"], title: a["title"] as string };
  }
  return { raw: a["raw"] };
}

function validateUpdateArgs(args: unknown): { id: string; raw: string } {
  if (typeof args !== "object" || args === null) {
    throw new McpValidationError("Arguments must be an object");
  }
  const a = args as Record<string, unknown>;
  if (typeof a["id"] !== "string" || a["id"].trim().length === 0) {
    throw new McpValidationError("`id` must be a non-empty string");
  }
  if (typeof a["raw"] !== "string" || a["raw"].trim().length === 0) {
    throw new McpValidationError("`raw` must be a non-empty string");
  }
  if (a["raw"].length > 350_000) {
    throw new McpValidationError("`raw` exceeds 350,000 character limit");
  }
  return { id: a["id"], raw: a["raw"] };
}

function validateListArgs(args: unknown): { limit: number } {
  const defaultLimit = 20;
  if (typeof args !== "object" || args === null) {
    return { limit: defaultLimit };
  }
  const a = args as Record<string, unknown>;
  if (a["limit"] === undefined) {
    return { limit: defaultLimit };
  }
  if (typeof a["limit"] !== "number" || !Number.isInteger(a["limit"]) || a["limit"] < 1) {
    throw new McpValidationError("`limit` must be a positive integer");
  }
  return { limit: Math.min(a["limit"], 50) };
}

function validateDeleteArgs(args: unknown): { id: string } {
  if (typeof args !== "object" || args === null) {
    throw new McpValidationError("Arguments must be an object");
  }
  const a = args as Record<string, unknown>;
  if (typeof a["id"] !== "string" || a["id"].trim().length === 0) {
    throw new McpValidationError("`id` must be a non-empty string");
  }
  if (a["confirm"] !== true) {
    throw new McpValidationError(
      "`confirm` must be true to delete a page. This action cannot be undone.",
    );
  }
  return { id: a["id"] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Readable API client
// ─────────────────────────────────────────────────────────────────────────────

const UPSTREAM_TIMEOUT_MS = 10_000; // 10 s — fail fast, don't hang the SSE session

async function callReadableApi(
  path: string,
  method: string,
  apiKey: string,
  body?: unknown,
  apiBase: string = "https://readable.ashwinsathian.com",
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const hasBody = body !== undefined;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "User-Agent": "Readable-MCP/1.0",
  };
  // Only set Content-Type when there is a request body (GET/DELETE have none)
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : null,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = { error: "Non-JSON response from Readable API" };
  }

  return { ok: res.ok, status: res.status, data };
}

// All ERRORS helpers return McpErrorShape. The return annotation here is
// explicit so callers don't accidentally narrow to a specific variant.
function mapUpstreamError(status: number): McpErrorShape {
  if (status === 401) return ERRORS.UNAUTHORIZED();
  if (status === 403) return ERRORS.FORBIDDEN();
  if (status === 404) return ERRORS.NOT_FOUND("Page");
  if (status === 413) return ERRORS.DOCUMENT_TOO_LARGE();
  if (status === 429) return ERRORS.RATE_LIMITED();
  return ERRORS.UPSTREAM(status);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool result helpers
// ─────────────────────────────────────────────────────────────────────────────

function successResult(text: string) {
  return { content: [{ type: "text", text }] };
}

function errorResult(text: string) {
  return { content: [{ type: "text", text: `Error: ${text}` }], isError: true };
}

// Escape characters that would break a Markdown table cell.
// Pipes become \|, newlines/carriage returns become spaces.
function escapeMdCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool handlers
// ─────────────────────────────────────────────────────────────────────────────

export async function handlePublishPage(
  args: unknown,
  apiKey: string,
  apiBase: string,
): Promise<unknown> {
  try {
    const { raw, title } = validatePublishArgs(args);
    const body: Record<string, string> = { raw };
    if (title !== undefined) body["title"] = title;

    const { ok, status, data } = await callReadableApi(
      "/api/v1/publish",
      "POST",
      apiKey,
      body,
      apiBase,
    );

    if (!ok) return errorResult(mapUpstreamError(status).message);

    const r = data as PublishResponse;
    return successResult(
      `Page published.\n\nURL: ${r.url}\nID: ${r.id}\n\nShare this link. The page is live and permanent.`,
    );
  } catch (e) {
    if (e instanceof McpValidationError) return errorResult(e.message);
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return errorResult("Request to Readable API timed out. Try again.");
    }
    console.error("publish_page unexpected error:", e);
    return errorResult("An unexpected error occurred");
  }
}

export async function handleUpdatePage(
  args: unknown,
  apiKey: string,
  apiBase: string,
): Promise<unknown> {
  try {
    const { id, raw } = validateUpdateArgs(args);

    const { ok, status, data } = await callReadableApi(
      `/api/v1/pages/${encodeURIComponent(id)}`,
      "PATCH",
      apiKey,
      { raw },
      apiBase,
    );

    if (!ok) return errorResult(mapUpstreamError(status).message);

    const r = data as UpdateResponse;
    return successResult(
      `Page updated.\n\nURL: ${r.url}\nUpdated: ${r.updated_at}\n\nVisitors who already have the link will see the new content.`,
    );
  } catch (e) {
    if (e instanceof McpValidationError) return errorResult(e.message);
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return errorResult("Request to Readable API timed out. Try again.");
    }
    console.error("update_page unexpected error:", e);
    return errorResult("An unexpected error occurred");
  }
}

export async function handleListPages(
  args: unknown,
  apiKey: string,
  apiBase: string,
): Promise<unknown> {
  try {
    const { limit } = validateListArgs(args);

    const { ok, status, data } = await callReadableApi(
      `/api/v1/pages?limit=${limit}`,
      "GET",
      apiKey,
      undefined,
      apiBase,
    );

    if (!ok) return errorResult(mapUpstreamError(status).message);

    const pages = (data as { pages: PageListItem[] }).pages;

    if (pages.length === 0) {
      return successResult("No pages found. Publish your first page with publish_page.");
    }

    const header = "| Title | ID | URL | Views | Visibility |\n|---|---|---|---|---|";
    const rows = pages
      .map(
        (p) =>
          `| ${escapeMdCell(p.title)} | ${p.id} | ${p.url} | ${p.view_count} | ${p.visibility} |`,
      )
      .join("\n");

    return successResult(`Your Readable pages (${pages.length}):\n\n${header}\n${rows}`);
  } catch (e) {
    if (e instanceof McpValidationError) return errorResult(e.message);
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return errorResult("Request to Readable API timed out. Try again.");
    }
    console.error("list_pages unexpected error:", e);
    return errorResult("An unexpected error occurred");
  }
}

export async function handleDeletePage(
  args: unknown,
  apiKey: string,
  apiBase: string,
): Promise<unknown> {
  try {
    const { id } = validateDeleteArgs(args);

    const { ok, status } = await callReadableApi(
      `/api/v1/pages/${encodeURIComponent(id)}`,
      "DELETE",
      apiKey,
      undefined,
      apiBase,
    );

    if (!ok) return errorResult(mapUpstreamError(status).message);

    return successResult(`Page ${id} deleted. The URL is no longer accessible.`);
  } catch (e) {
    if (e instanceof McpValidationError) return errorResult(e.message);
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return errorResult("Request to Readable API timed out. Try again.");
    }
    console.error("delete_page unexpected error:", e);
    return errorResult("An unexpected error occurred");
  }
}
