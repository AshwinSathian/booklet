import { absoluteUrl, buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = buildMetadata({
  title: "Add Booklet to Claude — MCP Setup",
  description:
    "Connect Booklet's MCP server to Claude Desktop, Claude.ai, Cursor, Windsurf, VS Code or Zed, then publish and manage pages from a conversation.",
  pathname: "/mcp-setup",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Add Booklet to Claude — MCP Setup",
  description:
    "Connect Booklet's MCP server to Claude Desktop, Claude.ai, Cursor, Windsurf, VS Code or Zed, then publish and manage pages from a conversation.",
  url: absoluteUrl("/mcp-setup"),
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "MCP Setup", item: absoluteUrl("/mcp-setup") },
    ],
  },
};

export default function McpSetupLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
