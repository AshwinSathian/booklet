import type { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ERRORS, type McpErrorShape } from "./errors.js";
import { createClient, BookletApiError, type PageListItem, type PatchPageRequest } from "booklet-api-client";
import type {
  PublishPageInputSchema,
  UpdatePageInputSchema,
  GetPageInputSchema,
  ListPagesInputSchema,
  DeletePageInputSchema,
} from "./schemas.js";

// ─────────────────────────────────────────────────────────────────────────────
// Booklet API client — one instance per MCP call (stateless server; apiKey
// and apiBase both vary per incoming request). Delegates the actual
// HTTP/auth/JSON-parsing work to booklet-api-client, shared with
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

type ResultContentItem = CallToolResult["content"][number];

function resourceLink(id: string, name: string): ResultContentItem {
  return { type: "resource_link", uri: `booklet://pages/${id}`, name, mimeType: "text/markdown" };
}

function toolResult(
  text: string,
  opts?: { link?: ResultContentItem; structuredContent?: Record<string, unknown> },
): CallToolResult {
  const content: ResultContentItem[] = [{ type: "text", text }];
  if (opts?.link) content.push(opts.link);
  return { content, ...(opts?.structuredContent ? { structuredContent: opts.structuredContent } : {}) };
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: "text", text: `Error: ${text}` }], isError: true };
}

function escapeMdCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

/**
 * Human-readable clause describing an active list_pages filter, e.g.
 * ` matching title contains "release" and tag "ops"` — empty string when
 * neither filter is set. Split out from handleListPages so it's testable
 * without mocking the network client.
 */
export function buildFilterNote(query?: string, tag?: string): string {
  const descriptors: string[] = [];
  if (query) descriptors.push(`title contains "${query}"`);
  if (tag) descriptors.push(`tag "${tag}"`);
  return descriptors.length > 0 ? ` matching ${descriptors.join(" and ")}` : "";
}

function unexpectedError(toolName: string, e: unknown): CallToolResult {
  if (e instanceof BookletApiError) return errorResult(mapUpstreamError(e).message);
  if (e instanceof DOMException && e.name === "TimeoutError") {
    return errorResult("Request to Booklet API timed out. Try again.");
  }
  console.error(`${toolName} unexpected error:`, e);
  return errorResult("An unexpected error occurred");
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool handlers — args are already validated by the SDK against the Zod
// schemas in schemas.ts before any of these run.
// ─────────────────────────────────────────────────────────────────────────────

export async function handlePublishPage(
  args: z.infer<typeof PublishPageInputSchema>,
  apiKey: string,
  apiBase: string,
): Promise<CallToolResult> {
  try {
    const { raw, title, slug, visibility } = args;

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
    return toolResult(
      `Page published.\n\nURL: ${r.url}\nID: ${r.id}\n\nShare this link. The page is live and permanent.`,
      { link: resourceLink(r.id, title ?? r.id), structuredContent: { id: r.id, url: r.url } },
    );
  } catch (e) {
    return unexpectedError("publish_page", e);
  }
}

export async function handleUpdatePage(
  args: z.infer<typeof UpdatePageInputSchema>,
  apiKey: string,
  apiBase: string,
): Promise<CallToolResult> {
  try {
    const { id, raw, slug, visibility } = args;

    const patch: PatchPageRequest = {};
    if (raw !== undefined) patch.raw = raw;
    if (slug !== undefined) patch.slug = slug;
    if (visibility !== undefined) patch.visibility = visibility;

    const r = await client(apiKey, apiBase).updatePage(id, patch);
    const lines = [`Page updated.\n\nURL: ${r.url}`];
    if (r.updated_at) lines.push(`Updated: ${r.updated_at}`);
    lines.push("\nVisitors who already have the link will see the new content.");
    return toolResult(lines.join("\n"), {
      link: resourceLink(r.id, r.id),
      structuredContent: { id: r.id, url: r.url, ...(r.updated_at ? { updated_at: r.updated_at } : {}) },
    });
  } catch (e) {
    return unexpectedError("update_page", e);
  }
}

// Above this many characters, get_page omits the inline body and points at
// resources/read instead. Booklet pages can be up to 350,000 characters —
// inlining that on every metadata check would be ~90K+ tokens of context for
// no reason. 8,000 chars comfortably covers the vast majority of real pages
// (incident reports, ADRs, release notes) without ever truncating them.
const INLINE_CONTENT_THRESHOLD = 8_000;

export async function handleGetPage(
  args: z.infer<typeof GetPageInputSchema>,
  apiKey: string,
  apiBase: string,
): Promise<CallToolResult> {
  try {
    const { id } = args;

    const r = await client(apiKey, apiBase).getPage(id);
    const sections: string[] = [
      `**${r.title ?? "(untitled)"}**`,
      `ID: ${r.id}${r.slug ? ` · Slug: ${r.slug}` : ""}`,
      `URL: ${r.url}`,
      `Visibility: ${r.visibility} · Views: ${r.view_count}`,
      `Created: ${r.created_at} · Updated: ${r.updated_at}`,
    ];

    const rawLength = r.raw?.length ?? 0;
    const inline = r.raw !== null && rawLength <= INLINE_CONTENT_THRESHOLD;

    if (inline) {
      sections.push("\n---\n");
      sections.push(r.raw as string);
    } else if (r.raw === null) {
      sections.push("\n*(No raw Markdown stored for this page)*");
    } else {
      sections.push(
        `\n*(Content omitted: ${rawLength.toLocaleString()} characters, over the ${INLINE_CONTENT_THRESHOLD.toLocaleString()}-character inline limit. Fetch it via resources/read on booklet://pages/${r.id}, or open the URL above.)*`,
      );
    }

    return toolResult(sections.join("\n"), {
      link: resourceLink(r.id, r.title ?? r.id),
      structuredContent: {
        id: r.id,
        title: r.title,
        slug: r.slug,
        visibility: r.visibility,
        view_count: r.view_count,
        url: r.url,
        created_at: r.created_at,
        updated_at: r.updated_at,
        content_omitted: !inline,
        ...(r.raw !== null ? { content_length: rawLength } : {}),
      },
    });
  } catch (e) {
    return unexpectedError("get_page", e);
  }
}

export async function handleListPages(
  args: z.infer<typeof ListPagesInputSchema>,
  apiKey: string,
  apiBase: string,
): Promise<CallToolResult> {
  try {
    const limit = args.limit ?? 20;
    const offset = args.offset ?? 0;
    const { query, tag } = args;

    const result = await client(apiKey, apiBase).listPages({
      limit,
      offset,
      ...(query !== undefined ? { query } : {}),
      ...(tag !== undefined ? { tag } : {}),
    });
    const pages = result.pages ?? [];
    const total = result.total ?? pages.length;

    const filterNote = buildFilterNote(query, tag);

    if (pages.length === 0) {
      return toolResult(
        filterNote
          ? `No pages found${filterNote}. Try a broader query, or list_pages with no filters to see everything.`
          : "No pages found. Publish your first page with publish_page.",
      );
    }

    const header = "| Title | ID | URL | Views | Visibility |\n|---|---|---|---|---|";
    const rows = pages
      .map(
        (p: PageListItem) =>
          `| ${escapeMdCell(p.title ?? "(untitled)")} | ${p.id} | ${p.url} | ${p.view_count} | ${p.visibility} |`,
      )
      .join("\n");

    const shown = offset + pages.length;
    const paginationNote = total > shown
      ? `\n\n*(Showing ${offset + 1}–${shown} of ${total} total. Use \`offset: ${shown}\` to fetch the next page.)*`
      : total > pages.length
      ? `\n\n*(Showing ${offset + 1}–${shown} of ${total} total.)*`
      : "";

    // No structuredContent here, deliberately: an N-row table duplicated as
    // a JSON array scales token cost with data size for no chaining benefit
    // — nothing in this server's tool surface consumes a list_pages result
    // programmatically.
    return toolResult(`Your Booklet pages${filterNote} (${pages.length}):\n\n${header}\n${rows}${paginationNote}`);
  } catch (e) {
    return unexpectedError("list_pages", e);
  }
}

export async function handleDeletePage(
  args: z.infer<typeof DeletePageInputSchema>,
  apiKey: string,
  apiBase: string,
): Promise<CallToolResult> {
  try {
    const { id } = args;

    await client(apiKey, apiBase).deletePage(id);
    return toolResult(`Page ${id} deleted. The URL is no longer accessible.`, {
      structuredContent: { id, deleted: true },
    });
  } catch (e) {
    return unexpectedError("delete_page", e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Resources handler (MCP Resources capability)
// Exposes user's pages as browsable, readable MCP resources.
// ─────────────────────────────────────────────────────────────────────────────

export async function handleResourcesList(apiKey: string, apiBase: string): Promise<unknown> {
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

export async function handleResourcesRead(uri: string, apiKey: string, apiBase: string): Promise<unknown> {
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
