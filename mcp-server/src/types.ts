// MCP JSON-RPC types
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

// MCP resources/read params
export interface ResourceReadParams {
  uri: string;
}

// MCP prompts/get params
export interface PromptGetParams {
  name: string;
  arguments?: Record<string, string>;
}

// Readable API response types
export interface PublishResponse {
  id: string;
  url: string;
}

export interface PageListItem {
  id: string;
  title: string | null;
  slug: string | null;
  url: string;
  visibility: "public" | "unlisted";
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface PageListResponse {
  pages: PageListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface PageDetailResponse {
  id: string;
  title: string | null;
  slug: string | null;
  url: string;
  visibility: "public" | "unlisted";
  view_count: number;
  created_at: string;
  updated_at: string;
  raw: string | null;
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
