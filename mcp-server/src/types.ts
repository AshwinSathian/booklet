// MCP JSON-RPC types
// id is optional because MCP notifications (e.g. notifications/initialized) have no id
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// MCP tool call types
export interface ToolCallParams {
  name: string;
  arguments: Record<string, unknown>;
}

// Session type
export interface Session {
  id: string;
  apiKey: string;
  // Uint8Array because we always enqueue encoder.encode(...) output
  controller: ReadableStreamDefaultController<Uint8Array>;
  lastActivity: number;
}

// Readable API response types
export interface PublishResponse {
  id: string;
  url: string;
}

export interface PageListItem {
  id: string;
  title: string;
  slug: string | null;
  url: string;
  visibility: "public" | "unlisted";
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface PageListResponse {
  pages: PageListItem[];
}

export interface UpdateResponse {
  id: string;
  url: string;
  updated_at: string;
}

// Worker env bindings
export interface Env {
  READABLE_API_BASE: string;
  MCP_SERVER_NAME: string;
  MCP_SERVER_VERSION: string;
}
