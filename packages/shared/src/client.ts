/**
 * Thin typed fetch client for /api/v1/*. Deliberately no dependencies beyond
 * global fetch (Node 22+) and zod — every consumer (CLI, GitHub Action,
 * MCP server) already runs on a fetch-capable runtime.
 *
 * Throws BookletApiError on any non-2xx response, carrying the upstream HTTP
 * status, the server's message, the parsed problem-details body and, on a
 * 429, the Retry-After delay.
 * The GitHub Action uses this throw-and-catch shape directly; packages/cli
 * and mcp-server each build their own
 * non-throwing `{ok, ...}` wrapper on top for command-flow control (e.g.
 * `process.exit(1)`) — a thin adapter around this client, not a rewrite of
 * their command logic.
 */

import {
  ListPagesResponseSchema,
  PageDetailResponseSchema,
  PatchPageResponseSchema,
  PublishResponseSchema,
  DeletePageResponseSchema,
  type ListPagesResponse,
  type PageDetailResponse,
  type PatchPageRequest,
  type PatchPageResponse,
  type PublishResponse,
  type DeletePageResponse,
  type ApiError,
  type DocType,
  type Visibility,
} from "./schemas.js";

export type ClientOptions = {
  baseUrl: string;
  apiKey: string;
  /** Sent as X-Booklet-Source, e.g. "cli" | "github-action" | "mcp". */
  source: string;
  fetchTimeoutMs?: number;
  /**
   * On a 429, wait for the server's Retry-After (at most 60 seconds) and try
   * once more. Off by default: a caller with its own deadline, such as the
   * MCP server, should fail fast instead.
   */
  retryOnRateLimit?: boolean;
};

const MAX_RETRY_AFTER_S = 60;

export class BookletApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** The response body, when it was a JSON object (RFC 9457 problem details). */
    public readonly problem?: ApiError,
    /** Seconds from the Retry-After header of a 429. */
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "BookletApiError";
  }
}

export function createClient(options: ClientOptions) {
  const { baseUrl, apiKey, source, fetchTimeoutMs = 15_000, retryOnRateLimit = false } = options;

  async function request(path: string, init?: RequestInit, mayRetry = retryOnRateLimit): Promise<{ body: unknown; headers: Headers }> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${apiKey}`,
          "X-Booklet-Source": source,
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
        signal: AbortSignal.timeout(fetchTimeoutMs),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BookletApiError(`Network error: ${msg}`, 0);
    }

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* no/invalid JSON body — fall through to status-only handling below */
    }

    if (!res.ok) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const hasRetryAfter = res.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0;
      if (hasRetryAfter && mayRetry && retryAfter <= MAX_RETRY_AFTER_S) {
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        return request(path, init, false);
      }
      const problem = body && typeof body === "object" ? (body as ApiError) : undefined;
      const message = typeof problem?.detail === "string" ? problem.detail : `HTTP ${res.status}`;
      throw new BookletApiError(message, res.status, problem, hasRetryAfter ? retryAfter : undefined);
    }

    return { body, headers: res.headers };
  }

  return {
    async listPages(params?: {
      limit?: number;
      /** `next_cursor` from the previous response. */
      cursor?: string;
      /** Case-insensitive substring match against page title. */
      query?: string;
      /** Exact match against a page's frontmatter tags. */
      tag?: string;
      /** Only pages of this document type. */
      type?: DocType;
      /** Slug of a team space you belong to: lists every page in it, not only yours. */
      space?: string;
    }): Promise<ListPagesResponse> {
      const qp = new URLSearchParams();
      if (params?.limit) qp.set("limit", String(params.limit));
      if (params?.cursor) qp.set("cursor", params.cursor);
      if (params?.query) qp.set("q", params.query);
      if (params?.tag) qp.set("tag", params.tag);
      if (params?.type) qp.set("type", params.type);
      if (params?.space) qp.set("space", params.space);
      const qs = qp.toString();
      const { body } = await request(`/api/v1/pages${qs ? `?${qs}` : ""}`);
      return ListPagesResponseSchema.parse(body);
    },

    /** Every page, walking `next_cursor` until the list ends. */
    async listAllPages(params?: { query?: string; tag?: string; type?: DocType; space?: string }): Promise<ListPagesResponse["pages"]> {
      const all: ListPagesResponse["pages"] = [];
      let cursor: string | undefined;
      do {
        const page = await this.listPages({ ...params, limit: 100, ...(cursor ? { cursor } : {}) });
        all.push(...page.pages);
        cursor = page.next_cursor ?? undefined;
      } while (cursor);
      return all;
    },

    async publishPage(
      raw: string,
      opts?: {
        visibility?: Visibility | undefined;
        /** Slug of a team space to create the page in. */
        space?: string | undefined;
        /** Makes a retry safe: a repeat with the same key and body returns the first response. */
        idempotencyKey?: string;
      },
    ): Promise<PublishResponse> {
      const { body } = await request("/api/v1/publish", {
        method: "POST",
        body: JSON.stringify({
          raw,
          ...(opts?.visibility ? { visibility: opts.visibility } : {}),
          ...(opts?.space ? { space: opts.space } : {}),
        }),
        ...(opts?.idempotencyKey ? { headers: { "Idempotency-Key": opts.idempotencyKey } } : {}),
      });
      return PublishResponseSchema.parse(body);
    },

    /** `ifMatch`: apply only if the page still has this ETag (412 otherwise). */
    async updatePage(id: string, patch: PatchPageRequest, opts?: { ifMatch?: string }): Promise<PatchPageResponse> {
      const { body } = await request(`/api/v1/pages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
        ...(opts?.ifMatch ? { headers: { "If-Match": opts.ifMatch } } : {}),
      });
      return PatchPageResponseSchema.parse(body);
    },

    /** `id` may be a page ID or a custom slug. */
    async getPage(id: string): Promise<PageDetailResponse & { etag: string | null }> {
      const { body, headers } = await request(`/api/v1/pages/${encodeURIComponent(id)}`);
      return { ...PageDetailResponseSchema.parse(body), etag: headers.get("etag") };
    },

    async deletePage(id: string, opts?: { ifMatch?: string }): Promise<DeletePageResponse> {
      const { body } = await request(`/api/v1/pages/${encodeURIComponent(id)}`, {
        method: "DELETE",
        ...(opts?.ifMatch ? { headers: { "If-Match": opts.ifMatch } } : {}),
      });
      return DeletePageResponseSchema.parse(body);
    },
  };
}

export type BookletClient = ReturnType<typeof createClient>;
