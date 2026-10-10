// Worker env bindings
export interface Env {
  /** Where the Booklet API is reached from this process (loopback in production). */
  BOOKLET_API_BASE: string;
  /** Public origin of the Booklet app: the OAuth authorization server. */
  BOOKLET_PUBLIC_URL?: string;
  /** Public URL of this server's /mcp endpoint: the OAuth resource identifier. */
  MCP_PUBLIC_URL?: string;
}
