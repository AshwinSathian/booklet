/**
 * Canonical public site origin for building shareable URLs from within a
 * request handler. Prefers NEXT_PUBLIC_SITE_URL (the real public domain)
 * over the request's own origin — req.url's origin is wrong whenever the
 * request arrived over an internal hop rather than directly from a
 * browser/external client, e.g. the MCP server calling /api/v1/* via
 * http://localhost:3100 (see ecosystem.config.js's READABLE_API_BASE and
 * docs/OPERATIONS.md). Without this, a page published through the MCP
 * server gets back a `url` field like "http://localhost:3100/p/abc" —
 * technically correct from the API's own vantage point, useless to whoever
 * receives it.
 */
export function getSiteOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Malformed env value — fall through to the request's own origin
      // rather than crash the request.
    }
  }
  return new URL(req.url).origin;
}
