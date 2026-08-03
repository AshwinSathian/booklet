import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
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
} from "./schemas.js";
import {
  handlePublishPage,
  handleUpdatePage,
  handleGetPage,
  handleListPages,
  handleDeletePage,
  handleResourcesList,
  handleResourcesRead,
} from "./tools.js";
import { PROMPT_DEFINITIONS, renderPrompt } from "./prompts.js";

const SERVER_VERSION = "2.0.0";

export const TOOL_NAMES = [
  "publish_page",
  "update_page",
  "get_page",
  "list_pages",
  "delete_page",
] as const;

export const PROMPT_NAMES = PROMPT_DEFINITIONS.map((p) => p.name);

/**
 * Builds a fresh, fully-wired McpServer for a single request. Stateless by
 * design (no session, no state kept between calls) — matches the
 * WebStandardStreamableHTTPServerTransport's stateless mode used in
 * index.ts, and the server's pre-existing per-request auth model.
 */
export function createMcpServer(apiBase: string, apiKey: string): McpServer {
  const server = new McpServer({ name: "booklet", version: SERVER_VERSION });

  server.registerTool(
    "publish_page",
    {
      title: "Publish Page",
      description: "Publish a new Booklet page from Markdown. Returns a permanent, public URL.",
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
      description: "List Booklet pages owned by your account, with pagination via limit/offset.",
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
