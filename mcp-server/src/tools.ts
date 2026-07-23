import { ERRORS, McpValidationError, type McpErrorShape } from "./errors.js";
import { createClient, BookletApiError, type PageListItem, type PatchPageRequest } from "booklet-api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions (JSON Schema)
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: "publish_page",
    description:
      "Publish a new Booklet page from Markdown text. Returns a public URL that can be shared immediately. The page is permanent and associated with your Booklet account.",
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
          description: "Override the page title. If omitted, Booklet extracts the first H1.",
        },
        slug: {
          type: "string",
          description:
            "Custom URL slug (e.g. \"my-release-notes\"). 3-60 lowercase letters, numbers, or hyphens (no leading/trailing/consecutive hyphens). Results in a URL like /p/my-release-notes.",
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
      "Update the content or metadata of an existing Booklet page you own. The URL stays the same — visitors who already have the link will see the new content. Use list_pages to find page IDs.",
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
      "List Booklet pages owned by your account. Returns page IDs, titles, URLs, view counts, and visibility. Supports pagination via limit and offset.",
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
      "Permanently delete a Booklet page. This cannot be undone and the URL will stop working immediately. Visitors who already have the link will see a 404. Use list_pages to confirm the correct page ID before deleting.",
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

// Mirrors src/lib/slug.ts's canonical rule in the main app (3-60 chars,
// no leading/trailing/consecutive hyphens) — this package is a standalone
// npm workspace with no shared build step with the main app, so the rule
// is duplicated here rather than imported. Keep in sync if that file
// changes: the two previously drifted (this used to allow 1-2 char slugs,
// which the REST API's v1/publish and v1/pages routes now reject with a
// 422 after the slug-validation unification), causing a wasted round trip
// for anything shorter than 3 characters.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{3,60}$/;
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
      throw new McpValidationError("`slug` must be 3-60 lowercase letters, numbers, or hyphens (no leading/trailing/consecutive hyphens)");
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
      throw new McpValidationError("`slug` must be 3-60 lowercase letters, numbers, or hyphens (no leading/trailing/consecutive hyphens)");
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
// Booklet API client — one instance per MCP call (stateless server; apiKey
// and apiBase both vary per incoming request, see src/index.ts). Delegates
// the actual HTTP/auth/JSON-parsing work to booklet-api-client, shared with
// packages/cli, packages/github-action, and packages/vscode.
// ─────────────────────────────────────────────────────────────────────────────

const UPSTREAM_TIMEOUT_MS = 10_000;

function client(apiKey: string, apiBase: string) {
  return createClient({ baseUrl: apiBase, apiKey, source: "mcp", fetchTimeoutMs: UPSTREAM_TIMEOUT_MS });
}

/**
 * For 400/409/422 the REST API already returns a specific, human-readable
 * message (e.g. "Invalid slug. Use 3-60 lowercase letters..." or "Slug is
 * already taken.") — BookletApiError.message carries that verbatim, so
 * surfacing it directly keeps MCP clients (Claude, Cursor, etc.) able to act
 * on the failure instead of seeing a generic "HTTP <status>".
 */
function mapUpstreamError(err: BookletApiError): McpErrorShape {
  const { status, message } = err;
  if (status === 401) return ERRORS.UNAUTHORIZED();
  if (status === 403) return ERRORS.FORBIDDEN();
  if (status === 404) return ERRORS.NOT_FOUND("Page");
  if (status === 413) return ERRORS.DOCUMENT_TOO_LARGE();
  if (status === 429) return ERRORS.RATE_LIMITED();
  if (status === 400 || status === 409 || status === 422) return ERRORS.VALIDATION(message);
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

    const r = await client(apiKey, apiBase).publishPage(finalRaw);
    return successResult(
      `Page published.\n\nURL: ${r.url}\nID: ${r.id}\n\nShare this link. The page is live and permanent.`,
    );
  } catch (e) {
    if (e instanceof McpValidationError) return errorResult(e.message);
    if (e instanceof BookletApiError) return errorResult(mapUpstreamError(e).message);
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return errorResult("Request to Booklet API timed out. Try again.");
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

    const patch: PatchPageRequest = {};
    if (raw !== undefined) patch.raw = raw;
    if (slug !== undefined) patch.slug = slug;
    if (visibility !== undefined) patch.visibility = visibility;

    const r = await client(apiKey, apiBase).updatePage(id, patch);
    const lines = [`Page updated.\n\nURL: ${r.url}`];
    if (r.updated_at) lines.push(`Updated: ${r.updated_at}`);
    lines.push("\nVisitors who already have the link will see the new content.");
    return successResult(lines.join("\n"));
  } catch (e) {
    if (e instanceof McpValidationError) return errorResult(e.message);
    if (e instanceof BookletApiError) return errorResult(mapUpstreamError(e).message);
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return errorResult("Request to Booklet API timed out. Try again.");
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

    const r = await client(apiKey, apiBase).getPage(id);
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
    if (e instanceof BookletApiError) return errorResult(mapUpstreamError(e).message);
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return errorResult("Request to Booklet API timed out. Try again.");
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

    const result = await client(apiKey, apiBase).listPages({ limit, offset });
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

    return successResult(`Your Booklet pages (${pages.length}):\n\n${header}\n${rows}${paginationNote}`);
  } catch (e) {
    if (e instanceof McpValidationError) return errorResult(e.message);
    if (e instanceof BookletApiError) return errorResult(mapUpstreamError(e).message);
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return errorResult("Request to Booklet API timed out. Try again.");
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

    await client(apiKey, apiBase).deletePage(id);
    return successResult(`Page ${id} deleted. The URL is no longer accessible.`);
  } catch (e) {
    if (e instanceof McpValidationError) return errorResult(e.message);
    if (e instanceof BookletApiError) return errorResult(mapUpstreamError(e).message);
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return errorResult("Request to Booklet API timed out. Try again.");
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
  let result: { pages: PageListItem[] };
  try {
    result = await client(apiKey, apiBase).listPages({ limit: 100, offset: 0 });
  } catch {
    return { resources: [] };
  }

  const resources = (result.pages ?? []).map((p) => ({
    uri: `booklet://pages/${p.id}`,
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
  const match = uri.match(/^booklet:\/\/pages\/(.+)$/);
  if (!match) {
    return {
      contents: [{ uri, mimeType: "text/plain", text: `Error: Invalid resource URI: ${uri}` }],
    };
  }

  const id = match[1] ?? "";
  let r;
  try {
    r = await client(apiKey, apiBase).getPage(id);
  } catch {
    return {
      contents: [{ uri, mimeType: "text/plain", text: `Error: Page not found or access denied.` }],
    };
  }

  const text = r.raw ?? `*(No raw Markdown stored for page ${id})*`;

  return {
    contents: [{ uri, mimeType: "text/markdown", text }],
  };
}
