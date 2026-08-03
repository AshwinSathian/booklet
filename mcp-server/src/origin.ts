// MCP Streamable HTTP transport security requirement: servers MUST validate
// the Origin header to guard against DNS-rebinding-style abuse. Every native
// MCP client (Claude Desktop, Cursor, Windsurf, VS Code, Zed — see
// /mcp-setup) issues plain HTTP calls with no browser Origin header at all;
// those pass through unchecked. Only a present-and-unrecognized Origin is
// rejected. Exact string match — no wildcards, no subdomain matching.
const ALLOWED_ORIGINS = new Set(["https://claude.ai", "https://booklet.ashwinsathian.com"]);

export function isAllowedOrigin(origin: string | null): boolean {
  if (origin === null) return true;
  return ALLOWED_ORIGINS.has(origin);
}
