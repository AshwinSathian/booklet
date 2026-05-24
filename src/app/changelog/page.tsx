import { AppLogo } from "@/components/ui/AppLogo";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import Link from "next/link";
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
  New: "bg-emerald-500/15 text-emerald-400",
  Improved: "bg-blue-500/15 text-blue-400",
  Fixed: "bg-amber-500/15 text-amber-400",
  Removed: "bg-red-500/15 text-red-400",
};

const RELEASES: Release[] = [
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
      { date: "2026-05-25", tag: "New", text: "/about, /privacy, /terms pages — the legal and identity content Readable was missing" },
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
      { date: "2026-04-29", tag: "New", text: "MCP server — publish Readable pages from Claude, Cursor, Windsurf, and VS Code" },
      { date: "2026-04-29", tag: "New", text: "Complete visual redesign: new design system, typography, color tokens, and brand identity" },
      { date: "2026-04-29", tag: "New", text: "Comprehensive SEO: JSON-LD structured data, llms.txt, sitemap, and Open Graph images" },
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
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-3xl px-4 h-12 flex items-center justify-between gap-4">
          <Link href={ROUTES.home}>
            <AppLogo onlyIcon={false} />
          </Link>
          <Link
            href={ROUTES.app}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-pill border border-outline px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
          >
            Open editor
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">What's new</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary mb-2">Changelog</h1>
          <p className="text-sm text-text-secondary">
            A running log of improvements, fixes, and new features in {APP_NAME}.
          </p>
        </div>

        <div className="flex flex-col gap-12">
          {RELEASES.map((release) => (
            <section key={release.version} className="flex flex-col gap-5">
              <div className="flex items-baseline gap-3 pb-3 border-b border-border-subtle">
                <h2 className="text-lg font-bold text-text-primary">{release.version}</h2>
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

      <footer className="border-t border-border-subtle">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
          <span>© {new Date().getFullYear()} {APP_NAME}</span>
          <nav className="flex items-center gap-4">
            <Link href="/about" className="hover:text-text-primary transition">About</Link>
            <Link href="/privacy" className="hover:text-text-primary transition">Privacy</Link>
            <Link href="/terms" className="hover:text-text-primary transition">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
