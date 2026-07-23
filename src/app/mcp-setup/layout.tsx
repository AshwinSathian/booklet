import { absoluteUrl, buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = buildMetadata({
  title: "Add Booklet to Claude — MCP Setup",
  description:
    "Connect Booklet to Claude Desktop, Claude.ai, or any MCP-compatible AI assistant. Publish and manage Markdown pages directly from your AI assistant in plain language.",
  pathname: "/mcp-setup",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Add Booklet to Claude — MCP Setup",
  description:
    "Connect Booklet to Claude Desktop, Claude.ai, or any MCP-compatible AI assistant. Publish and manage Markdown pages directly from your AI assistant.",
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
