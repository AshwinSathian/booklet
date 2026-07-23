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

// Booklet API response types now live in booklet-api-client (packages/shared)
// — see src/tools.ts's import.

// Worker env bindings
export interface Env {
  BOOKLET_API_BASE: string;
  MCP_SERVER_NAME: string;
  MCP_SERVER_VERSION: string;
}
