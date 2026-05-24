import { ERRORS, McpValidationError, type McpErrorShape } from "./errors.js";
import type { PageListItem, PageDetailResponse, PublishResponse, UpdateResponse } from "./types.js";

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
        slug: {
          type: "string",
          description:
            "Custom URL slug (e.g. \"my-release-notes\"). 1–60 lowercase letters, numbers, or hyphens. Results in a URL like /p/my-release-notes.",
        },
        visibility: {
          type: "string",
          enum: ["public", "unlisted"],
          description:
            "\"public\" (default) lists the page publicly. \"unlisted\" hides it from listings but keeps it accessible via URL.",
        },
      },
      required: ["raw"],
    },
  },
  {
    name: "update_page",
    description:
      "Update the content or metadata of an existing Readable page you own. The URL stays the same — visitors who already have the link will see the new content. Use list_pages to find page IDs.",
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
        slug: {
          type: "string",
          description: "New custom URL slug. Pass null to remove the custom slug and revert to the page ID.",
        },
        visibility: {
          type: "string",
          enum: ["public", "unlisted"],
          description: "Change visibility to \"public\" or \"unlisted\".",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "get_page",
    description:
      "Retrieve full details and raw Markdown content of a specific page you own. Use this to read back what was published, verify content before updating, or inspect metadata.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The page ID or custom slug to retrieve.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "list_pages",
    description:
      "List Readable pages owned by your account. Returns page IDs, titles, URLs, view counts, and visibility. Supports pagination via limit and offset.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum pages to return. Default 20, max 100.",
        },
        offset: {
          type: "number",
          description: "Number of pages to skip for pagination. Default 0.",
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

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$|^[a-z0-9]{1,2}$/;
function isValidSlug(s: string): boolean {
  return SLUG_PATTERN.test(s) && !s.includes("--");
}

function validatePublishArgs(args: unknown): { raw: string; title?: string; slug?: string; visibility?: "public" | "unlisted" } {
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
  if (a["slug"] !== undefined) {
    if (typeof a["slug"] !== "string") throw new McpValidationError("`slug` must be a string");
    if (!isValidSlug(a["slug"])) {
      throw new McpValidationError("`slug` must be 1–60 lowercase letters, numbers, or hyphens (no leading/trailing/double hyphens)");
    }
  }
  if (a["visibility"] !== undefined && a["visibility"] !== "public" && a["visibility"] !== "unlisted") {
    throw new McpValidationError('`visibility` must be "public" or "unlisted"');
  }
  return {
    raw: a["raw"],
    ...(a["title"] !== undefined ? { title: a["title"] as string } : {}),
    ...(a["slug"] !== undefined ? { slug: a["slug"] as string } : {}),
    ...(a["visibility"] !== undefined ? { visibility: a["visibility"] as "public" | "unlisted" } : {}),
  };
}

function validateUpdateArgs(args: unknown): { id: string; raw?: string; slug?: string | null; visibility?: "public" | "unlisted" } {
  if (typeof args !== "object" || args === null) {
    throw new McpValidationError("Arguments must be an object");
  }
  const a = args as Record<string, unknown>;
  if (typeof a["id"] !== "string" || a["id"].trim().length === 0) {
    throw new McpValidationError("`id` must be a non-empty string");
  }
  if (a["raw"] !== undefined) {
    if (typeof a["raw"] !== "string" || a["raw"].trim().length === 0) {
      throw new McpValidationError("`raw` must be a non-empty string if provided");
    }
    if (a["raw"].length > 350_000) {
      throw new McpValidationError("`raw` exceeds 350,000 character limit");
    }
  }
  if (a["slug"] !== undefined && a["slug"] !== null) {
    if (typeof a["slug"] !== "string") throw new McpValidationError("`slug` must be a string or null");
    if (!isValidSlug(a["slug"])) {
      throw new McpValidationError("`slug` must be 1–60 lowercase letters, numbers, or hyphens");
    }
  }
  if (a["visibility"] !== undefined && a["visibility"] !== "public" && a["visibility"] !== "unlisted") {
    throw new McpValidationError('`visibility` must be "public" or "unlisted"');
  }
  const hasContent = a["raw"] !== undefined;
  const hasMeta = a["slug"] !== undefined || a["visibility"] !== undefined;
  if (!hasContent && !hasMeta) {
    throw new McpValidationError("Provide at least one of: `raw`, `slug`, `visibility`");
  }
  return {
    id: a["id"],
    ...(a["raw"] !== undefined ? { raw: a["raw"] as string } : {}),
    ...(a["slug"] !== undefined ? { slug: (a["slug"] as string | null) } : {}),
    ...(a["visibility"] !== undefined ? { visibility: a["visibility"] as "public" | "unlisted" } : {}),
  };
}

function validateGetArgs(args: unknown): { id: string } {
  if (typeof args !== "object" || args === null) {
    throw new McpValidationError("Arguments must be an object");
  }
  const a = args as Record<string, unknown>;
  if (typeof a["id"] !== "string" || a["id"].trim().length === 0) {
    throw new McpValidationError("`id` must be a non-empty string");
  }
  return { id: a["id"] };
}

function validateListArgs(args: unknown): { limit: number; offset: number } {
  const defaultLimit = 20;
  if (typeof args !== "object" || args === null) {
    return { limit: defaultLimit, offset: 0 };
  }
  const a = args as Record<string, unknown>;
  let limit = defaultLimit;
  let offset = 0;

  if (a["limit"] !== undefined) {
    if (typeof a["limit"] !== "number" || !Number.isInteger(a["limit"]) || a["limit"] < 1) {
      throw new McpValidationError("`limit` must be a positive integer");
    }
    limit = Math.min(a["limit"], 100);
  }

  if (a["offset"] !== undefined) {
    if (typeof a["offset"] !== "number" || !Number.isInteger(a["offset"]) || a["offset"] < 0) {
      throw new McpValidationError("`offset` must be a non-negative integer");
    }
    offset = a["offset"];
  }

  return { limit, offset };
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

const UPSTREAM_TIMEOUT_MS = 10_000;

async function callReadableApi(
  path: string,
  method: string,
  apiKey: string,
  apiBase: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const hasBody = body !== undefined;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "User-Agent": "Readable-MCP/1.0",
  };
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
    const { raw, title, slug, visibility } = validatePublishArgs(args);

    // The v1/publish endpoint reads slug/visibility from YAML frontmatter.
    let finalRaw = raw;
    if (slug !== undefined || visibility !== undefined || title !== undefined) {
      const fmLines = ["---"];
      if (title !== undefined) fmLines.push(`title: "${title.replace(/"/g, '\\"')}"`);
      if (slug !== undefined) fmLines.push(`slug: ${slug}`);
      if (visibility !== undefined) fmLines.push(`visibility: ${visibility}`);
      fmLines.push("---");
      finalRaw = fmLines.join("\n") + "\n" + raw;
    }

    const { ok, status, data } = await callReadableApi(
      "/api/v1/publish",
      "POST",
      apiKey,
      apiBase,
      { raw: finalRaw },
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
    const { id, raw, slug, visibility } = validateUpdateArgs(args);

    const body: Record<string, unknown> = {};
    if (raw !== undefined) body["raw"] = raw;
    if (slug !== undefined) body["slug"] = slug;
    if (visibility !== undefined) body["visibility"] = visibility;

    const { ok, status, data } = await callReadableApi(
      `/api/v1/pages/${encodeURIComponent(id)}`,
      "PATCH",
      apiKey,
      apiBase,
      body,
    );

    if (!ok) return errorResult(mapUpstreamError(status).message);

    const r = data as UpdateResponse;
    const lines = [`Page updated.\n\nURL: ${r.url}`];
    if (r.updated_at) lines.push(`Updated: ${r.updated_at}`);
    lines.push("\nVisitors who already have the link will see the new content.");
    return successResult(lines.join("\n"));
  } catch (e) {
    if (e instanceof McpValidationError) return errorResult(e.message);
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return errorResult("Request to Readable API timed out. Try again.");
    }
    console.error("update_page unexpected error:", e);
    return errorResult("An unexpected error occurred");
  }
}

export async function handleGetPage(
  args: unknown,
  apiKey: string,
  apiBase: string,
): Promise<unknown> {
  try {
    const { id } = validateGetArgs(args);

    const { ok, status, data } = await callReadableApi(
      `/api/v1/pages/${encodeURIComponent(id)}`,
      "GET",
      apiKey,
      apiBase,
    );

    if (!ok) return errorResult(mapUpstreamError(status).message);

    const r = data as PageDetailResponse;
    const sections: string[] = [
      `**${r.title ?? "(untitled)"}**`,
      `ID: ${r.id}${r.slug ? ` · Slug: ${r.slug}` : ""}`,
      `URL: ${r.url}`,
      `Visibility: ${r.visibility} · Views: ${r.view_count}`,
      `Created: ${r.created_at} · Updated: ${r.updated_at}`,
    ];

    if (r.raw) {
      sections.push("\n---\n");
      sections.push(r.raw);
    } else {
      sections.push("\n*(No raw Markdown stored for this page)*");
    }

    return successResult(sections.join("\n"));
  } catch (e) {
    if (e instanceof McpValidationError) return errorResult(e.message);
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return errorResult("Request to Readable API timed out. Try again.");
    }
    console.error("get_page unexpected error:", e);
    return errorResult("An unexpected error occurred");
  }
}

export async function handleListPages(
  args: unknown,
  apiKey: string,
  apiBase: string,
): Promise<unknown> {
  try {
    const { limit, offset } = validateListArgs(args);

    const { ok, status, data } = await callReadableApi(
      `/api/v1/pages?limit=${limit}&offset=${offset}`,
      "GET",
      apiKey,
      apiBase,
    );

    if (!ok) return errorResult(mapUpstreamError(status).message);

    const result = data as { pages: PageListItem[]; total: number; limit: number; offset: number };
    const pages = result.pages ?? [];
    const total = result.total ?? pages.length;

    if (pages.length === 0) {
      return successResult("No pages found. Publish your first page with publish_page.");
    }

    const header = "| Title | ID | URL | Views | Visibility |\n|---|---|---|---|---|";
    const rows = pages
      .map(
        (p) =>
          `| ${escapeMdCell(p.title ?? "(untitled)")} | ${p.id} | ${p.url} | ${p.view_count} | ${p.visibility} |`,
      )
      .join("\n");

    const shown = offset + pages.length;
    const paginationNote = total > shown
      ? `\n\n*(Showing ${offset + 1}–${shown} of ${total} total. Use \`offset: ${shown}\` to fetch the next page.)*`
      : total > pages.length
      ? `\n\n*(Showing ${offset + 1}–${shown} of ${total} total.)*`
      : "";

    return successResult(`Your Readable pages (${pages.length}):\n\n${header}\n${rows}${paginationNote}`);
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

// ─────────────────────────────────────────────────────────────────────────────
// Resources handler (MCP Resources capability)
// Exposes user's pages as browsable, readable MCP resources.
// ─────────────────────────────────────────────────────────────────────────────

export async function handleResourcesList(
  apiKey: string,
  apiBase: string,
): Promise<unknown> {
  const { ok, data } = await callReadableApi(
    "/api/v1/pages?limit=100&offset=0",
    "GET",
    apiKey,
    apiBase,
  );

  if (!ok) {
    return { resources: [] };
  }

  const result = data as { pages: PageListItem[] };
  const resources = (result.pages ?? []).map((p) => ({
    uri: `readable://pages/${p.id}`,
    name: p.title ?? p.id,
    description: `${p.visibility} · ${p.view_count} views · ${p.url}`,
    mimeType: "text/markdown",
  }));

  return { resources };
}

export async function handleResourcesRead(
  uri: string,
  apiKey: string,
  apiBase: string,
): Promise<unknown> {
  const match = uri.match(/^readable:\/\/pages\/(.+)$/);
  if (!match) {
    return {
      contents: [{ uri, mimeType: "text/plain", text: `Error: Invalid resource URI: ${uri}` }],
    };
  }

  const id = match[1] ?? "";
  const { ok, data } = await callReadableApi(
    `/api/v1/pages/${encodeURIComponent(id)}`,
    "GET",
    apiKey,
    apiBase,
  );

  if (!ok) {
    return {
      contents: [{ uri, mimeType: "text/plain", text: `Error: Page not found or access denied.` }],
    };
  }

  const r = data as PageDetailResponse;
  const text = r.raw ?? `*(No raw Markdown stored for page ${id})*`;

  return {
    contents: [{ uri, mimeType: "text/markdown", text }],
  };
}
