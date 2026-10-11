export function mcpError(code: number, message: string, data?: unknown) {
  return { code, message, ...(data !== undefined ? { data } : {}) };
}

// Canonical shape returned by all ERRORS helpers and used as the error field in JSON-RPC responses
export type McpErrorShape = ReturnType<typeof mcpError>;

export const ERRORS = {
  PARSE_ERROR: (msg?: string) => mcpError(-32700, msg ?? "Parse error"),
  INVALID_REQUEST: (msg?: string) => mcpError(-32600, msg ?? "Invalid request"),
  METHOD_NOT_FOUND: (method: string) => mcpError(-32601, `Method not found: ${method}`),
  INVALID_PARAMS: (msg: string) => mcpError(-32602, `Invalid params: ${msg}`),
  INTERNAL: (msg?: string) => mcpError(-32603, msg ?? "Internal error"),
  // Application-level errors (MCP convention: -32000 to -32099)
  UNAUTHORIZED: () =>
    mcpError(-32001, "Not signed in to Booklet, or the API key is wrong or was deleted. Reconnect, or create a key at booklet.ashwinsathian.com/settings/api-keys"),
  RATE_LIMITED: () =>
    mcpError(-32002, "Rate limit reached. Wait a minute and try again."),
  NOT_FOUND: (resource: string) => mcpError(-32003, `${resource} not found`),
  FORBIDDEN: () => mcpError(-32004, "You do not own this page"),
  UPSTREAM: (status: number) =>
    mcpError(-32006, `Booklet API returned an unexpected error (HTTP ${status})`),
  // For client-error statuses the REST API already returns a specific,
  // human-readable `{ error: string }` body (invalid/colliding slug, bad
  // visibility value, etc.) — surface that verbatim instead of a generic
  // "HTTP 422" so an MCP client (Claude, Cursor, etc.) can actually act on
  // it, e.g. by trying a different slug.
  VALIDATION: (message: string) => mcpError(-32007, message),
};
