import type { PublishEvent } from "@/lib/db/types";

// The 4 first-party API clients (packages/cli, packages/github-action,
// packages/vscode, mcp-server) already send X-Readable-Source on every
// request — see packages/shared/src/client.ts's createClient(). The server
// side never read it before this file existed, so every one of those
// clients (plus raw API-key usage) collapsed into a single "api" bucket —
// making it impossible to see MCP/agent-driven publish volume separately
// from CLI or CI usage.
const KNOWN_CLIENT_SOURCES = new Set<PublishEvent["source"]>([
  "cli",
  "github-action",
  "vscode",
  "mcp",
]);

/**
 * Resolves the publish_events `source` for an authenticated /api/v1
 * request. Only trusts the header value if it matches one of the 4 known
 * first-party clients; anything else (missing header, typo, a future
 * client we don't recognize yet) falls back to the generic "api" bucket
 * rather than writing an arbitrary caller-supplied string into analytics.
 */
export function resolveApiClientSource(req: Request): PublishEvent["source"] {
  const header = req.headers.get("x-readable-source")?.trim().toLowerCase();
  if (header && KNOWN_CLIENT_SOURCES.has(header as PublishEvent["source"])) {
    return header as PublishEvent["source"];
  }
  return "api";
}
