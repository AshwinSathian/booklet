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
        "Publish Markdown incident reports, ADRs, RFCs and runbooks as web pages, with team spaces. Publish from the editor, the CLI, the REST API, a GitHub Action or an MCP client.",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web Browser",
      screenshot: absoluteUrl("/opengraph-image"),
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free. There is no paid plan.",
      },
      featureList: [
        "Markdown rendering",
        "Live preview",
        "Document types: incident, postmortem, ADR, RFC, runbook, release notes",
        "Team spaces with pages restricted to members",
        "Links between published documents",
        "Code block rendering",
        "Table rendering",
        "No account required",
        "Drafts saved in the browser and synced to an account",
        "Pages that do not expire when published from an account",
        "REST API for publishing from scripts and automation",
        "Command-line interface (booklet-cli)",
        "GitHub Action for publishing docs in CI",
        "MCP server for Claude and other MCP clients",
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
        "Publish Markdown incident reports, ADRs, RFCs and runbooks as web pages, with team spaces.",
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
      name: `${APP_NAME} — Engineering Documents, Published as Pages`,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#app` },
      description:
        "Publish Markdown incident reports, ADRs, RFCs and runbooks as web pages, with team spaces.",
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
