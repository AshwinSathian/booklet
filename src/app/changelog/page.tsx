import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { APP_NAME } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "Changelog",
  description: `What's new in ${APP_NAME} — a running log of improvements, fixes, and new features.`,
  pathname: "/changelog",
});

type Entry = {
  date: string;
  tag: "New" | "Improved" | "Fixed" | "Removed";
  text: string;
};

type Release = {
  version: string;
  date: string;
  summary: string;
  entries: Entry[];
};

const TAG_COLORS: Record<Entry["tag"], string> = {
  New: "bg-success/15 text-success",
  Improved: "bg-info/15 text-info",
  Fixed: "bg-special/15 text-special",
  Removed: "bg-danger/15 text-danger",
};

const RELEASES: Release[] = [
  {
    version: "v2.0.1",
    date: "2026-10-11",
    summary: "Mermaid diagrams are sanitized before they are shown, and the editor's visibility control is a proper menu.",
    entries: [
      { date: "2026-10-11", tag: "Fixed", text: "A Mermaid diagram could carry CSS that loaded an image from another host when the page was read. Diagrams are now checked as a parsed tree before they are mounted" },
      { date: "2026-10-11", tag: "Improved", text: "The visibility control beside Publish is a menu that says, under each choice, who can find the page" },
      { date: "2026-10-11", tag: "Improved", text: "The example incident report and ADR show the header strip, and the incident links to the ADR" },
    ],
  },
  {
    version: "v2.0.0",
    date: "2026-10-11",
    summary: "Document types, links between pages and team spaces for engineering documents; accounts with verification and passkeys; OAuth for MCP clients. Older versions of several flows were removed, so this release breaks some API, CLI and MCP callers.",
    entries: [
      { date: "2026-10-11", tag: "New", text: "Document types. Put type: incident, postmortem, adr, rfc, runbook or release-notes in a page's frontmatter and it shows status, severity, date and owners in a strip under the title. The templates start with this frontmatter" },
      { date: "2026-10-11", tag: "New", text: "Links between published pages. [[Title]] becomes a link when a published page with that title is in the same team space, or among your own pages, and the linked page lists what references it" },
      { date: "2026-10-11", tag: "New", text: "Team spaces at /t. A space lists its pages by type, with a decision log in ADR-number order and incidents by date, and has an Atom feed of its public pages" },
      { date: "2026-10-11", tag: "New", text: "Team visibility: a page in a team space that its members can open and nobody else can" },
      { date: "2026-10-11", tag: "New", text: "Email verification, passkeys, and sign-in with GitHub or Google where the host has set them up" },
      { date: "2026-10-11", tag: "New", text: "Account settings: change password, sign-in methods, connected apps, a ZIP download of every page as Markdown, and account deletion" },
      { date: "2026-10-11", tag: "New", text: "After you sign in, drafts written in that browser beforehand can be moved into your account" },
      { date: "2026-10-11", tag: "New", text: "Settings pages for API keys and webhooks. Each webhook shows its last 50 deliveries, with a Resend button" },
      { date: "2026-10-11", tag: "New", text: "My pages shows how each page was last published: Web, API, CLI, MCP or Action" },
      { date: "2026-10-11", tag: "New", text: "Version history compares any two versions line by line. Restore asks first, and adds a new version" },
      { date: "2026-10-11", tag: "New", text: "Import from URL in the editor: a public Markdown file on GitHub opens as a new draft" },
      { date: "2026-10-11", tag: "New", text: "OAuth sign-in for MCP clients. A Claude.ai custom connector signs in with your Booklet account, with no API key to paste" },
      { date: "2026-10-11", tag: "New", text: "MCP tools create_document and search_pages" },
      { date: "2026-10-11", tag: "New", text: "API: Idempotency-Key on publish, ETag and If-Match on pages, RateLimit headers, and an OpenAPI 3.1 document at /api/v1/openapi.json" },
      { date: "2026-10-11", tag: "New", text: "/p/<id>.md returns a page's Markdown, for pages anyone with the link may read" },
      { date: "2026-10-11", tag: "New", text: "Trust page: who runs Booklet, where it is hosted, how it is backed up, and how to export or delete an account" },
      { date: "2026-10-11", tag: "Improved", text: "The HTML export draws Mermaid diagrams into the file. They used to export as source text" },
      { date: "2026-10-11", tag: "Improved", text: "Every page passes the WCAG 2.2 AA automated checks in both themes. Text colours were adjusted to reach a 4.5:1 contrast ratio" },
      { date: "2026-10-11", tag: "Improved", text: "The site's own description of itself was rewritten around engineering documents, and claims that could not be checked against the code were removed" },
      { date: "2026-10-11", tag: "Fixed", text: "The page.updated webhook event is sent. Webhooks could subscribe to it and nothing fired it" },
      { date: "2026-10-11", tag: "Fixed", text: "The editor no longer saves the open draft twice a second, which for signed-in users had kept drafts from syncing" },
      { date: "2026-10-11", tag: "Fixed", text: "A link to a page that does not exist answers 404. It used to answer 200 with a notice" },
      { date: "2026-10-11", tag: "Removed", text: "API errors no longer carry an error member beside the RFC 9457 fields. Read detail" },
      { date: "2026-10-11", tag: "Removed", text: "offset on GET /api/v1/pages. Page through the list with cursor" },
      { date: "2026-10-11", tag: "Removed", text: "API keys that start with rdbl_. Create a new key under Settings" },
      { date: "2026-10-11", tag: "Removed", text: "MCP protocol 2025-11-25. The server speaks 2026-07-28" },
      { date: "2026-10-11", tag: "Removed", text: "OAuth dynamic client registration. An MCP client identifies itself with a Client ID Metadata Document, as Claude.ai does, or uses an API key" },
      { date: "2026-10-11", tag: "Improved", text: "The MCP setup guide puts Claude.ai first and no longer asks Claude.ai users to create an API key they do not need" },
      { date: "2026-10-11", tag: "Fixed", text: "The Booklet connector shows Booklet's own icon in MCP clients, and the browser tab icon matches the current logo" },
      { date: "2026-10-11", tag: "Removed", text: "Page passwords set before September 2026 no longer open their page. The owner sets the password again" },
    ],
  },
  {
    version: "v1.1.0",
    date: "2026-10-10",
    summary: "The app is now AGPL-3.0, Google Analytics is gone, and several unused features were removed.",
    entries: [
      { date: "2026-10-10", tag: "Improved", text: "License: the web app is now AGPL-3.0-only. The CLI, API client, MCP server and GitHub Action stay MIT. The footer links to the source" },
      { date: "2026-10-10", tag: "Removed", text: "Google Analytics. No third-party analytics script loads on any page, and the content security policy no longer allows one. Page-view counts for page owners are first-party and unchanged" },
      { date: "2026-10-10", tag: "Removed", text: "Emoji reactions on published pages" },
      { date: "2026-10-10", tag: "Removed", text: "The floating \"make your own\" prompt on published pages. The footer attribution stays" },
      { date: "2026-10-10", tag: "Improved", text: "Explore is one list of public pages, newest first, with tag filtering. The Trending and Featured tabs and the \"Feature on Explore\" toggle are gone: a page appears on Explore when its visibility is Public" },
      { date: "2026-10-10", tag: "Fixed", text: "Typing in the editor's find box no longer jumps into the document, where the next keystroke replaced the first match" },
      { date: "2026-10-10", tag: "Improved", text: "/mcp now redirects to the MCP setup guide" },
      { date: "2026-10-10", tag: "Improved", text: "The service runs on Node.js 24. The CLI and API client now require Node.js 22 or later, starting with their next release" },
    ],
  },
  {
    version: "October 2026",
    date: "2026-10-10",
    summary: "New pages are unlisted by default, anonymous pages expire after 90 days, and every page can be reported.",
    entries: [
      { date: "2026-10-10", tag: "Improved", text: "New pages are unlisted: anyone with the link can read them, and they stay out of Explore and search engines unless you choose Public when you publish. Pages that were already public are unchanged. API and CLI users: pass visibility \"public\" to list a page" },
      { date: "2026-10-10", tag: "Improved", text: "Pages published without an account are now kept for 90 days. Open the page in the browser you published it from, sign in, and choose \"Keep this page\" to stop it expiring. Anonymous pages published before this date expire 90 days from it" },
      { date: "2026-10-10", tag: "New", text: "\"Report this page\" link on every published page and embed. A page that breaks the terms is taken down and its link returns 410 Gone" },
      { date: "2026-10-10", tag: "New", text: "The site, the API and the MCP server are checked every 10 minutes from outside, and the maintainer is emailed when one stops answering" },
      { date: "2026-10-10", tag: "Fixed", text: "Documents over 200,000 characters are rejected with a clear error. They used to publish with the stored Markdown source cut off at 200,000 characters" },
      { date: "2026-10-10", tag: "Fixed", text: "Undo (⌘Z / Ctrl+Z) now reverses toolbar formatting, slash-menu inserts, wikilink completion and replace-all in the editor" },
      { date: "2026-10-10", tag: "Fixed", text: "Links in published pages carry rel=\"nofollow ugc\", so publishing a page passes no search ranking to what it links to" },
      { date: "2026-10-10", tag: "Fixed", text: "Setup pages showed the API key prefix and secret name from before the rename; they now show bklt_ and BOOKLET_API_KEY" },
    ],
  },
  {
    version: "June–July 2026",
    date: "2026-07-22",
    summary: "In-house authentication, permanent anonymous pages, rich Markdown blocks, and a hardened parser.",
    entries: [
      { date: "2026-07-11", tag: "New", text: "In-house email + password authentication, replacing the previous third-party sign-in provider" },
      { date: "2026-07-10", tag: "New", text: "Anonymous pages are now permanent (previously a 30-day expiry) — capped at 10 publishes/month per IP; signed-in accounts have no monthly cap" },
      { date: "2026-07-22", tag: "New", text: "Rich Markdown blocks — callouts, collapsible toggle sections, multi-column layout, and Graphviz diagrams" },
      { date: "2026-07-11", tag: "New", text: "Distinct reading typography for published pages, with a per-document toggle" },
      { date: "2026-07-11", tag: "New", text: "Curated CSS theme gallery for published pages" },
      { date: "2026-07-11", tag: "New", text: "Cloud draft sync for signed-in users — drafts follow you across devices" },
      { date: "2026-06-09", tag: "New", text: "Find & replace, table insertion, and a keyboard shortcuts help modal in the editor" },
      { date: "2026-06-09", tag: "New", text: "Clickable tags, tag filtering on Explore, and a dedicated /integrations page" },
      { date: "2026-06-09", tag: "New", text: "Social share buttons and a scroll-triggered \"make your own\" CTA on share pages" },
      { date: "2026-07-11", tag: "Improved", text: "Analytics dashboard redesigned to match the app's visual system" },
      { date: "2026-07-11", tag: "Improved", text: "WCAG AA contrast pass and reduced-motion support across the site" },
      { date: "2026-07-22", tag: "Improved", text: "Markdown parsing pipeline rebuilt to close a denial-of-service vector in deeply nested input" },
      { date: "2026-07-11", tag: "Fixed", text: "Hardened authentication, sharing, and integration security across the platform" },
    ],
  },
  {
    version: "May 2026",
    date: "2026-05-25",
    summary: "Major overhaul — simplified pricing, expanded templates, focus mode, and much more.",
    entries: [
      { date: "2026-05-25", tag: "New", text: "Focus / zen mode in the editor — hide the preview pane for distraction-free writing (⌘.)" },
      { date: "2026-05-25", tag: "New", text: "21 templates across 7 categories (up from 9): Product Spec, Launch Checklist, API Changelog, Job Description, Data Dictionary, and more" },
      { date: "2026-05-25", tag: "New", text: "Collapsing sticky header on share pages — compresses to a minimal bar after 60px of scroll" },
      { date: "2026-05-25", tag: "New", text: "Attribution redesigned as a colophon footer — more dignified than the floating pill, always visible" },
      { date: "2026-05-25", tag: "New", text: "Explore page rebuilt: tabs (Recent / Trending / Featured), search/filter, 3-column grid, 96 pages shown" },
      { date: "2026-05-25", tag: "New", text: "Welcome email sent to new sign-ups via Resend" },
      { date: "2026-05-25", tag: "New", text: "Duplicate in editor: copy any published page into a local draft from My Pages" },
      { date: "2026-05-25", tag: "New", text: "/about, /privacy, /terms pages — the legal and identity content Booklet was missing" },
      { date: "2026-05-25", tag: "Improved", text: "Version history limit raised from 10 to 50 snapshots per page" },
      { date: "2026-05-25", tag: "Improved", text: "System theme is now the default on first visit (respects OS dark/light preference)" },
      { date: "2026-05-25", tag: "Improved", text: "API docs: all code examples use the live site URL instead of hardcoded strings" },
      { date: "2026-05-25", tag: "Removed", text: "Expiry countdown badge removed from reader share pages — expiry is an author concern, not a reader concern" },
      { date: "2026-05-25", tag: "Removed", text: "Attribution badge toggle removed — the badge is always on, for all pages, always" },
    ],
  },
  {
    version: "April 2026",
    date: "2026-04-29",
    summary: "Complete design overhaul, SEO improvements, and MCP server.",
    entries: [
      { date: "2026-04-29", tag: "New", text: "MCP server — publish Booklet pages from Claude, Cursor, Windsurf, and VS Code" },
      { date: "2026-04-29", tag: "New", text: "Complete visual redesign: new design system, typography, color tokens, and brand identity" },
      { date: "2026-04-29", tag: "New", text: "SEO: JSON-LD structured data, llms.txt, sitemap, and Open Graph images" },
      { date: "2026-04-29", tag: "New", text: "Mobile reading experience overhaul: sticky header, floating controls, scroll-aware TOC" },
      { date: "2026-04-29", tag: "New", text: "Mobile editor shell redesign: tab-based write/preview panes" },
      { date: "2026-04-29", tag: "Improved", text: "Reader progress bar and reading time estimate" },
      { date: "2026-04-29", tag: "Improved", text: "Share page: embed button, export menu (PDF, HTML, Markdown), and theme toggle" },
    ],
  },
];

function TagPill({ tag }: { tag: Entry["tag"] }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${TAG_COLORS[tag]}`}>
      {tag}
    </span>
  );
}

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">What&apos;s new</p>
          <h1 className="text-[clamp(22px,3.5vw,30px)] text-text-primary mb-2 font-display">Changelog</h1>
          <p className="text-sm text-text-secondary">
            A running log of improvements, fixes, and new features in {APP_NAME}.
          </p>
        </div>

        <div className="flex flex-col gap-12">
          {RELEASES.map((release) => (
            <section key={release.version} className="flex flex-col gap-5">
              <div className="flex items-baseline gap-3 pb-3 border-b border-border-subtle">
                <h2 className="text-lg text-text-primary font-display">{release.version}</h2>
                <p className="text-sm text-text-muted">{release.summary}</p>
              </div>

              <ul className="flex flex-col gap-3">
                {release.entries.map((entry, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="pt-0.5 shrink-0">
                      <TagPill tag={entry.tag} />
                    </div>
                    <span className="text-sm text-text-secondary leading-relaxed">{entry.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
