import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // /docs replaced three pages. A fragment on an old link is carried over by
  // the browser and resolved on arrival (src/components/docs/LegacyHashRedirect.tsx).
  redirects: async () => [
    { source: "/api-docs", destination: "/docs/reference/api", permanent: true },
    { source: "/integrations", destination: "/docs", permanent: true },
    { source: "/mcp-setup", destination: "/docs/guides/mcp", permanent: true },
    { source: "/mcp", destination: "/docs/guides/mcp", permanent: true },
  ],
};

export default nextConfig;
