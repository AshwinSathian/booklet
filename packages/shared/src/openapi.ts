/**
 * The OpenAPI 3.1 description of /api/v1, generated from the zod schemas in
 * schemas.ts. Served by the app at /api/v1/openapi.json, and the API docs
 * page renders its request and response examples from it, so the examples
 * cannot drift from the schemas the clients validate against.
 */

import { z } from "zod";
import {
  ApiErrorSchema,
  DeletePageResponseSchema,
  DOC_TYPES,
  ListPagesResponseSchema,
  PageDetailResponseSchema,
  PatchPageRequestSchema,
  PatchPageResponseSchema,
  PublishRequestSchema,
  PublishResponseSchema,
} from "./schemas.js";

const WebhookEventSchema = z.enum(["page.published", "page.updated"]);

const WebhookSchema = z.object({
  id: z.string(),
  url: z.string(),
  events: z.array(WebhookEventSchema),
  created_at: z.string(),
  last_triggered_at: z.string().nullable(),
});

const SCHEMAS = {
  PublishRequest: PublishRequestSchema,
  PublishResponse: PublishResponseSchema,
  PatchPageRequest: PatchPageRequestSchema,
  PatchPageResponse: PatchPageResponseSchema,
  PageDetail: PageDetailResponseSchema,
  ListPagesResponse: ListPagesResponseSchema,
  DeletePageResponse: DeletePageResponseSchema,
  Problem: ApiErrorSchema,
  WebhookList: z.object({ webhooks: z.array(WebhookSchema) }).meta({
    examples: [
      {
        webhooks: [
          {
            id: "Wk9xZ2mP1q",
            url: "https://hooks.example.com/booklet",
            events: ["page.published", "page.updated"],
            created_at: "2026-05-01T10:00:00.000Z",
            last_triggered_at: "2026-05-15T14:32:00.000Z",
          },
        ],
      },
    ],
  }),
  CreateWebhookRequest: z
    .object({ url: z.string(), events: z.array(WebhookEventSchema).optional() })
    .meta({ examples: [{ url: "https://hooks.example.com/booklet", events: ["page.published", "page.updated"] }] }),
  CreateWebhookResponse: z
    .object({ id: z.string(), url: z.string(), events: z.array(WebhookEventSchema), secret: z.string() })
    .meta({
      examples: [{ id: "Wk9xZ2mP1q", url: "https://hooks.example.com/booklet", events: ["page.published"], secret: "<shown once>" }],
    }),
  WebhookDelivery: z
    .object({ event: WebhookEventSchema, page_id: z.string(), page_url: z.string(), title: z.string().nullable(), published_at: z.string() })
    .meta({
      examples: [
        {
          event: "page.published",
          page_id: "Ab3k91QxZp",
          page_url: "https://booklet.ashwinsathian.com/p/Ab3k91QxZp",
          title: "Incident Report: Auth Service",
          published_at: "2026-05-19T08:32:00.000Z",
        },
      ],
    }),
} as const;

export type OpenApiSchemaName = keyof typeof SCHEMAS;

const ref = (name: OpenApiSchemaName) => ({ $ref: `#/components/schemas/${name}` });
const json = (name: OpenApiSchemaName) => ({ content: { "application/json": { schema: ref(name) } } });

const RATE_HEADERS = {
  RateLimit: { $ref: "#/components/headers/RateLimit" },
  "RateLimit-Policy": { $ref: "#/components/headers/RateLimit-Policy" },
};

function ok(description: string, name: OpenApiSchemaName, headers: Record<string, unknown> = {}) {
  return { description, headers: { ...RATE_HEADERS, ...headers }, ...json(name) };
}

const ERROR_TEXT: Record<number, string> = {
  400: "Invalid JSON, an empty document, or a malformed parameter",
  401: "Missing or invalid credential",
  403: "The page belongs to another account, the token lacks the scope, or the account's email address is not confirmed yet",
  404: "Page not found",
  409: "Slug already taken, or a request with this Idempotency-Key is still running",
  410: "The page was taken down",
  412: "If-Match did not match the page's current ETag",
  413: "Document too large; `limit` says whether characters or stored bytes",
  422: "Invalid slug, visibility or document type, `team` visibility on a page outside a team space, or the Idempotency-Key was reused with a different body",
  429: "Rate limit exceeded; wait for Retry-After seconds",
};

function errors(...statuses: number[]) {
  return Object.fromEntries(statuses.map((s) => [String(s), { $ref: `#/components/responses/Error${s}` }]));
}

const ID_PARAM = { $ref: "#/components/parameters/PageId" };
const ETAG_HEADER = { ETag: { description: "Entity tag for the page. Send it back as If-Match.", schema: { type: "string" } } };
const IF_MATCH = {
  name: "If-Match",
  in: "header",
  required: false,
  description: "Apply the change only if the page still has this ETag. A stale tag returns 412.",
  schema: { type: "string" },
};

export function buildOpenApi(version: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Booklet API",
      version,
      summary: "Publish and manage Booklet pages.",
      description:
        "All requests and responses are JSON. Timestamps are ISO 8601 UTC. Errors are RFC 9457 problem details.",
      license: { name: "AGPL-3.0-only", identifier: "AGPL-3.0-only" },
    },
    servers: [{ url: "https://booklet-api.ashwinsathian.com", description: "Production" }],
    security: [{ apiKey: [] }],
    tags: [
      { name: "Pages", description: "Publish, read, update, list and delete pages." },
      { name: "Webhooks", description: "Signed callbacks when a page is published or updated. Managed with a browser session, not an API key." },
    ],
    paths: {
      "/api/v1/publish": {
        post: {
          operationId: "publishPage",
          tags: ["Pages"],
          summary: "Publish a page",
          description: "Creates a page from Markdown and returns its URL. The page is unlisted unless `visibility` or frontmatter says otherwise. `space` creates it in a team space; `visibility: team` needs one.",
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              required: false,
              description:
                "Any unique string up to 255 characters. A repeat within 24 hours returns the first response instead of publishing again; the same key with a different body returns 422.",
              schema: { type: "string", maxLength: 255 },
            },
          ],
          requestBody: { required: true, ...json("PublishRequest") },
          responses: { "201": ok("The page was published", "PublishResponse"), ...errors(400, 401, 403, 404, 409, 413, 422, 429) },
        },
      },
      "/api/v1/pages": {
        get: {
          operationId: "listPages",
          tags: ["Pages"],
          summary: "List pages",
          description: "Pages owned by the caller, newest first.",
          parameters: [
            { name: "limit", in: "query", required: false, description: "Page size.", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
            {
              name: "cursor",
              in: "query",
              required: false,
              description: "`next_cursor` from the previous response. Pages added or deleted during the walk do not shift it.",
              schema: { type: "string" },
            },
            { name: "q", in: "query", required: false, description: "Case-insensitive match on the title.", schema: { type: "string" } },
            { name: "tag", in: "query", required: false, description: "Exact match on a frontmatter tag.", schema: { type: "string" } },
            { name: "type", in: "query", required: false, description: "Only pages of this document type (frontmatter `type`).", schema: { type: "string", enum: [...DOC_TYPES] } },
            { name: "space", in: "query", required: false, description: "Slug of a team space you belong to. Lists every page in the space, not only yours.", schema: { type: "string" } },
          ],
          responses: { "200": ok("One page of results", "ListPagesResponse"), ...errors(400, 401, 429) },
        },
      },
      "/api/v1/pages/{id}": {
        get: {
          operationId: "getPage",
          tags: ["Pages"],
          summary: "Read a page",
          description: "Metadata and the raw Markdown. `id` may be the page ID or its custom slug.",
          parameters: [ID_PARAM],
          responses: { "200": ok("The page", "PageDetail", ETAG_HEADER), ...errors(401, 403, 404, 410, 429) },
        },
        patch: {
          operationId: "updatePage",
          tags: ["Pages"],
          summary: "Update a page",
          description: "Replaces the content, or changes the slug or visibility. The URL stays the same. Send any combination of the fields.",
          parameters: [ID_PARAM, IF_MATCH],
          requestBody: { required: true, ...json("PatchPageRequest") },
          responses: { "200": ok("The page was updated", "PatchPageResponse", ETAG_HEADER), ...errors(400, 401, 403, 404, 409, 410, 412, 413, 422, 429) },
        },
        delete: {
          operationId: "deletePage",
          tags: ["Pages"],
          summary: "Delete a page",
          description: "Permanent. The URL stops working at once.",
          parameters: [ID_PARAM, IF_MATCH],
          responses: { "200": ok("The page was deleted", "DeletePageResponse"), ...errors(401, 403, 404, 410, 412, 429) },
        },
      },
      "/api/webhooks": {
        get: {
          operationId: "listWebhooks",
          tags: ["Webhooks"],
          summary: "List webhooks",
          description: "Secrets are not returned.",
          security: [{ session: [] }],
          responses: { "200": { description: "Registered webhooks", ...json("WebhookList") }, ...errors(401) },
        },
        post: {
          operationId: "createWebhook",
          tags: ["Webhooks"],
          summary: "Register a webhook",
          description: "Returns the signing secret once. At most 5 webhooks per account.",
          security: [{ session: [] }],
          requestBody: { required: true, ...json("CreateWebhookRequest") },
          responses: { "201": { description: "The webhook, with its secret", ...json("CreateWebhookResponse") }, ...errors(400, 401, 422) },
        },
      },
      "/api/webhooks/{id}": {
        delete: {
          operationId: "deleteWebhook",
          tags: ["Webhooks"],
          summary: "Remove a webhook",
          security: [{ session: [] }],
          parameters: [{ name: "id", in: "path", required: true, description: "Webhook ID.", schema: { type: "string" } }],
          responses: { "204": { description: "Removed" }, ...errors(401) },
        },
      },
    },
    webhooks: {
      pagePublished: {
        post: {
          operationId: "onPageEvent",
          tags: ["Webhooks"],
          summary: "A page was published or updated",
          description: "Sent to each registered URL. `X-Booklet-Signature` is `sha256=` plus the HMAC-SHA256 of the raw body under the webhook secret.",
          security: [],
          requestBody: { required: true, ...json("WebhookDelivery") },
          responses: { "200": { description: "Any 2xx acknowledges the delivery" } },
        },
      },
    },
    components: {
      securitySchemes: {
        apiKey: { type: "http", scheme: "bearer", description: "An API key (`bklt_` plus 40 characters) from the dashboard, or an OAuth access token issued to an MCP client." },
        session: { type: "apiKey", in: "cookie", name: "booklet_session", description: "The browser session cookie." },
      },
      parameters: {
        PageId: { name: "id", in: "path", required: true, description: "Page ID.", schema: { type: "string" } },
      },
      headers: {
        RateLimit: {
          description: 'Remaining quota and seconds until it resets, e.g. `"default";r=59;t=42` (draft-ietf-httpapi-ratelimit-headers).',
          schema: { type: "string" },
        },
        "RateLimit-Policy": { description: 'The quota: `"default";q=60;w=60` is 60 requests per 60 seconds.', schema: { type: "string" } },
      },
      responses: Object.fromEntries(
        Object.entries(ERROR_TEXT).map(([status, description]) => [
          `Error${status}`,
          { description, content: { "application/problem+json": { schema: ref("Problem") } } },
        ]),
      ),
      schemas: Object.fromEntries(
        Object.entries(SCHEMAS).map(([name, schema]) => {
          const { $schema: _dialect, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
          return [name, rest];
        }),
      ),
    },
  };
}

/** The first example attached to a schema, for documentation. */
export function schemaExamples(name: OpenApiSchemaName): unknown[] {
  return (z.toJSONSchema(SCHEMAS[name]) as { examples?: unknown[] }).examples ?? [];
}
