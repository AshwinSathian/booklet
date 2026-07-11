/**
 * Thin typed fetch client for /api/v1/*. Deliberately no dependencies beyond
 * global fetch (Node 18+) — every consumer (CLI, GitHub Action, VS Code
 * extension, MCP server) already runs on a fetch-capable runtime.
 */

import { ListPagesResponseSchema, type ListPagesResponse } from "./schemas.js";

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
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${apiKey}`,
        "X-Readable-Source": source,
      },
      signal: AbortSignal.timeout(fetchTimeoutMs),
    });

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: unknown };
        if (typeof body.error === "string") message = body.error;
      } catch {
        /* ignore — fall back to the generic status message */
      }
      throw new ReadableApiError(message, res.status);
    }

    return res.json();
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
  };
}
