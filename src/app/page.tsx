import { Landing } from "@/components/marketing/Landing";
import { APP_NAME } from "@/lib/constants";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({ pathname: "/" });

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://booklet.ashwinsathian.com";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: APP_NAME,
      url: SITE_URL,
      description:
        "Convert any Markdown into a clean, beautifully formatted shareable page in seconds. Perfect for incident reports, ADRs, READMEs, and technical docs. Publish from the editor, a script, CI, or your AI assistant via MCP.",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web Browser",
      screenshot: absoluteUrl("/opengraph-image"),
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free — no account required",
      },
      featureList: [
        "Markdown rendering",
        "Live preview",
        "One-click publishing",
        "Shareable URL",
        "Beautiful typography",
        "Code block rendering",
        "Table rendering",
        "No account required",
        "Draft auto-save to localStorage",
        "Permanent published pages",
        "REST API for publishing from scripts and automation",
        "Command-line interface (booklet-cli)",
        "GitHub Action for publishing docs in CI",
        "MCP server for publishing from Claude, Cursor, and other AI assistants",
      ],
      creator: {
        "@type": "Person",
        name: "Ashwin Sathian",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: APP_NAME,
      description:
        "Share beautiful Markdown pages instantly — free, no account required.",
      inLanguage: "en-US",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/app`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: `${APP_NAME} — Share Beautiful Markdown Pages Instantly`,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      description:
        "Convert any Markdown into a clean, beautifully formatted shareable page in seconds.",
      inLanguage: "en-US",
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Landing />
    </>
  );
}
