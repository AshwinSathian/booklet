/**
 * Thin typed fetch client for /api/v1/*. Deliberately no dependencies beyond
 * global fetch (Node 18+) and zod — every consumer (CLI, GitHub Action, VS
 * Code extension, MCP server) already runs on a fetch-capable runtime.
 *
 * Throws ReadableApiError on any non-2xx response, carrying both the
 * upstream HTTP status and the server's own `{error}` message when present.
 * Two of the four consumers (packages/github-action, packages/vscode)
 * already used exactly this throw-and-catch shape before this package
 * existed; the other two (packages/cli, mcp-server) each build their own
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
} from "./schemas.js";

export type ClientOptions = {
  baseUrl: string;
  apiKey: string;
  /** Sent as X-Readable-Source, e.g. "cli" | "github-action" | "vscode" | "mcp". */
  source: string;
  fetchTimeoutMs?: number;
};

export class ReadableApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ReadableApiError";
  }
}

export function createClient(options: ClientOptions) {
  const { baseUrl, apiKey, source, fetchTimeoutMs = 15_000 } = options;

  async function request(path: string, init?: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${apiKey}`,
          "X-Readable-Source": source,
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
        signal: AbortSignal.timeout(fetchTimeoutMs),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ReadableApiError(`Network error: ${msg}`, 0);
    }

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* no/invalid JSON body — fall through to status-only handling below */
    }

    if (!res.ok) {
      const message =
        body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : `HTTP ${res.status}`;
      throw new ReadableApiError(message, res.status);
    }

    return body;
  }

  return {
    async listPages(params?: { limit?: number; offset?: number }): Promise<ListPagesResponse> {
      const query = new URLSearchParams();
      if (params?.limit) query.set("limit", String(params.limit));
      if (params?.offset) query.set("offset", String(params.offset));
      const qs = query.toString();
      const body = await request(`/api/v1/pages${qs ? `?${qs}` : ""}`);
      return ListPagesResponseSchema.parse(body);
    },

    async publishPage(raw: string): Promise<PublishResponse> {
      const body = await request("/api/v1/publish", {
        method: "POST",
        body: JSON.stringify({ raw }),
      });
      return PublishResponseSchema.parse(body);
    },

    async updatePage(id: string, patch: PatchPageRequest): Promise<PatchPageResponse> {
      const body = await request(`/api/v1/pages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return PatchPageResponseSchema.parse(body);
    },

    async getPage(id: string): Promise<PageDetailResponse> {
      const body = await request(`/api/v1/pages/${encodeURIComponent(id)}`);
      return PageDetailResponseSchema.parse(body);
    },

    async deletePage(id: string): Promise<DeletePageResponse> {
      const body = await request(`/api/v1/pages/${encodeURIComponent(id)}`, { method: "DELETE" });
      return DeletePageResponseSchema.parse(body);
    },
  };
}

export type ReadableClient = ReturnType<typeof createClient>;
