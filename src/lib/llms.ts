import { getDocsTree } from "@/lib/docs";
import { absoluteUrl } from "@/lib/seo";
import { TEMPLATES } from "@/lib/templates";

/**
 * /llms.txt: what Booklet is and where its documentation lives, for a
 * language model or an agent reading the site. The list of docs pages is
 * built from content/docs, so it cannot fall behind the docs.
 */
export function llmsTxt(): string {
  const origin = absoluteUrl("/").replace(/\/$/, "");
  const docs = getDocsTree()
    .map(
      (section) =>
        `## ${section.title}\n\n${section.pages.map((p) => `- [${p.title}](${origin}${p.href}.md): ${p.description}`).join("\n")}`,
    )
    .join("\n\n");

  return `# Booklet

> Publish Markdown incident reports, ADRs, RFCs and runbooks as web pages, with team spaces.

Booklet publishes Markdown as a web page with a link. It is built for engineering documents: a page can carry a type, status and owners, link to other pages, and live in a team space. Publishing works from the web editor, a REST API, a CLI, a GitHub workflow and an MCP server. It can be tried without an account. It is free and has no paid plan.

- REST API base: ${origin}/api/v1 (OpenAPI 3.1 at ${origin}/api/v1/openapi.json). Auth: \`Authorization: Bearer bklt_...\`
- MCP endpoint: https://booklet-mcp.ashwinsathian.com/mcp (Streamable HTTP, protocol 2026-07-28; OAuth sign-in or the same API key)
- CLI: \`npx booklet-cli publish README.md\` (npm package booklet-cli)
- Every docs page below is Markdown at the linked address. All of them in one file: ${origin}/llms-full.txt
- A published page's Markdown is at its address with \`.md\` added, when anyone with the link may read it

${docs}

## Other pages

- [Editor](${origin}/app)
- [Templates](${origin}/templates): ${TEMPLATES.map((t) => t.name).join(", ")}
- [Pricing](${origin}/pricing): free, with and without an account
- [Trust](${origin}/trust): who runs it, where it is hosted, backups, export and deletion
- [Changelog](${origin}/changelog)
- [Source code](https://github.com/AshwinSathian/booklet): the app is AGPL-3.0; the CLI, API client, MCP server and GitHub Action are MIT
`;
}

/** /llms-full.txt: every docs page, one after another. */
export function llmsFullTxt(): string {
  const origin = absoluteUrl("/").replace(/\/$/, "");
  return getDocsTree()
    .flatMap((section) => section.pages)
    .map((p) => `# ${p.title}\n\nSource: ${origin}${p.href}\n\n${p.body}`)
    .join("\n\n---\n\n");
}
