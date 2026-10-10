import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  PublishPageInputSchema,
  UpdatePageInputSchema,
  GetPageInputSchema,
  ListPagesInputSchema,
  DeletePageInputSchema,
  PublishPageOutputSchema,
  UpdatePageOutputSchema,
  GetPageOutputSchema,
  DeletePageOutputSchema,
  CreateDocumentInputSchema,
  CreateDocumentOutputSchema,
  SearchPagesInputSchema,
  SearchPagesOutputSchema,
} from "./schemas.js";
import {
  handlePublishPage,
  handleUpdatePage,
  handleGetPage,
  handleListPages,
  handleDeletePage,
  handleCreateDocument,
  handleSearchPages,
  handleResourcesList,
  handleResourcesRead,
} from "./tools.js";
import { PROMPT_DEFINITIONS, renderPrompt } from "./prompts.js";

// Must match mcp-server/package.json and mcp-server/server.json (the MCP
// registry entry); tests/unit/mcp-version.spec.ts checks all three.
export const SERVER_VERSION = "4.0.0";

// Tools are registered, and so listed, in this order. Keep it fixed: a
// client caches tools/list, and a reordered list is a changed list.
export const TOOL_NAMES = [
  "publish_page",
  "update_page",
  "get_page",
  "list_pages",
  "delete_page",
  "create_document",
  "search_pages",
] as const;

export const PROMPT_NAMES = PROMPT_DEFINITIONS.map((p) => p.name);

/**
 * Builds a fresh, fully-wired McpServer for a single request. Stateless by
 * design (no session, no state kept between calls): createMcpHandler in
 * index.ts calls this once per request, for both protocol eras. `apiKey` is
 * the caller's bearer credential, an API key or an OAuth access token.
 */
export function createMcpServer(apiBase: string, apiKey: string, siteUrl = "https://booklet.ashwinsathian.com"): McpServer {
  const server = new McpServer(
    {
      name: "booklet",
      title: "Booklet",
      version: SERVER_VERSION,
      websiteUrl: siteUrl,
      // What a client shows beside the connector. Without it a client falls
      // back to whatever icon it finds for the host's parent domain.
      icons: [
        { src: `${siteUrl}/favicon.svg`, mimeType: "image/svg+xml", sizes: ["any"] },
        { src: `${siteUrl}/favicon.ico`, mimeType: "image/x-icon", sizes: ["32x32"] },
      ],
    },
    {
      // Cache hints for protocol 2026-07-28 list results; 2025-era responses
      // are unaffected. "private" everywhere: the resource list is per
      // account, and the rest costs nothing to keep private too.
      cacheHints: {
        "tools/list": { ttlMs: 300_000, cacheScope: "private" },
        "prompts/list": { ttlMs: 300_000, cacheScope: "private" },
        "resources/templates/list": { ttlMs: 300_000, cacheScope: "private" },
        "resources/list": { ttlMs: 30_000, cacheScope: "private" },
      },
    },
  );

  server.registerTool(
    "publish_page",
    {
      title: "Publish Page",
      description: "Publish a new Booklet page from Markdown. Returns its URL. The page is unlisted unless `visibility` is \"public\".",
      inputSchema: PublishPageInputSchema,
      outputSchema: PublishPageOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => handlePublishPage(args, apiKey, apiBase),
  );

  server.registerTool(
    "update_page",
    {
      title: "Update Page",
      description:
        "Update an existing Booklet page's content or metadata. The URL stays the same. Use list_pages to find page IDs.",
      inputSchema: UpdatePageInputSchema,
      outputSchema: UpdatePageOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => handleUpdatePage(args, apiKey, apiBase),
  );

  server.registerTool(
    "get_page",
    {
      title: "Get Page",
      description:
        "Retrieve metadata and (for pages under 8,000 characters) the raw Markdown of a specific page you own. Larger pages return metadata plus a resource link instead of the full body — follow up with resources/read to fetch it.",
      inputSchema: GetPageInputSchema,
      outputSchema: GetPageOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => handleGetPage(args, apiKey, apiBase),
  );

  server.registerTool(
    "list_pages",
    {
      title: "List Pages",
      description: "List Booklet pages owned by your account, newest first. Pass the cursor from a result to get the next page.",
      inputSchema: ListPagesInputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => handleListPages(args, apiKey, apiBase),
  );

  server.registerTool(
    "delete_page",
    {
      title: "Delete Page",
      description:
        "Permanently delete a Booklet page. Cannot be undone — the URL stops working immediately. Use list_pages to confirm the ID first.",
      inputSchema: DeletePageInputSchema,
      outputSchema: DeletePageOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (args) => handleDeletePage(args, apiKey, apiBase),
  );

  server.registerTool(
    "create_document",
    {
      title: "Create Document",
      description:
        "Publish an engineering document (incident, postmortem, adr, rfc, runbook, release-notes) with its type, status and other fields. Use this instead of publish_page for those types; pass `space` to put it in a team space.",
      inputSchema: CreateDocumentInputSchema,
      outputSchema: CreateDocumentOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (args) => handleCreateDocument(args, apiKey, apiBase),
  );

  server.registerTool(
    "search_pages",
    {
      title: "Search Pages",
      description:
        "Find pages by title text, document type, or team space. Without `space` it searches your own pages; with it, every page in that space. Use it to find a page to link to as [[Title]] or to update.",
      inputSchema: SearchPagesInputSchema,
      outputSchema: SearchPagesOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => handleSearchPages(args, apiKey, apiBase),
  );

  server.registerResource(
    "pages",
    new ResourceTemplate("booklet://pages/{id}", {
      list: async () => (await handleResourcesList(apiKey, apiBase)) as { resources: never[] },
    }),
    { title: "Booklet Pages", mimeType: "text/markdown" },
    async (uri) => (await handleResourcesRead(uri.href, apiKey, apiBase)) as { contents: never[] },
  );

  for (const prompt of PROMPT_DEFINITIONS) {
    // All render* functions in prompts.ts apply sensible defaults for any
    // omitted argument, so every argument is modeled as an optional string
    // here regardless of PROMPT_DEFINITIONS' `required` metadata (a UI hint,
    // not an enforced constraint) — nothing breaks if it's left out.
    const argsSchemaShape = Object.fromEntries(
      prompt.arguments.map((a) => [a.name, z.string().optional().describe(a.description)]),
    );
    server.registerPrompt(
      prompt.name,
      { title: prompt.name, description: prompt.description, argsSchema: argsSchemaShape },
      async (args) => {
        const template = renderPrompt(prompt.name, (args ?? {}) as Record<string, string>);
        return {
          description: prompt.description,
          messages: [{ role: "user" as const, content: { type: "text" as const, text: template ?? "" } }],
        };
      },
    );
  }

  return server;
}
