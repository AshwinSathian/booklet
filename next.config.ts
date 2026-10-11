import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  poweredByHeader: false,
  // /docs replaced three pages. A fragment on an old link is carried over by
  // the browser and resolved on arrival (src/components/docs/LegacyHashRedirect.tsx).
  redirects: async () => [
    { source: "/api-docs", destination: "/docs/reference/api", permanent: true },
    { source: "/integrations", destination: "/docs", permanent: true },
    { source: "/mcp-setup", destination: "/docs/guides/mcp", permanent: true },
    { source: "/mcp", destination: "/docs/guides/mcp", permanent: true },
    { source: "/templates/adr", destination: "/templates/architecture-decision-record", permanent: true },
    // The link-preview image used to be an SVG at these two paths. Links shared before still ask for them.
    { source: "/opengraph-image", destination: "/og/site.png", permanent: true },
    { source: "/twitter-image", destination: "/og/site.png", permanent: true },
  ],
};

export default nextConfig;
