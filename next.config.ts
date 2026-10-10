import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // /mcp was a second marketing page for the MCP server; /mcp-setup is the one page now.
  redirects: async () => [{ source: "/mcp", destination: "/mcp-setup", permanent: true }],
};

export default nextConfig;
