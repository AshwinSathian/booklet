import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description:
    `${APP_NAME} is a tool for sharing ideas clearly — paste Markdown, get a beautiful shareable page instantly. Built for engineers and writers who care about signal over noise.`,
  pathname: "/about",
});

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <SiteHeader ctaTrackLocation="about_topbar" />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">About</p>
          <h1 className="text-[clamp(26px,4vw,36px)] text-text-primary mb-6 font-display">
            {APP_NAME} — share ideas clearly
          </h1>

          <div className="prose-sm text-text-secondary flex flex-col gap-5 leading-relaxed">
            <p>
              {APP_NAME} started from a simple frustration: sharing technical content — incident reports,
              architecture decisions, release notes — was either ugly (raw Markdown in a Slack message) or
              slow (spinning up a Notion doc, fighting formatting, managing access). There was no middle path.
            </p>

            <p>
              {APP_NAME} is that middle path. Paste Markdown, get a beautifully formatted page with a shareable
              URL in seconds. No account required to start. No clutter. No ads. Just your content, rendered clearly.
            </p>

            <p>
              The design principle is ruthless: every pixel that doesn&apos;t serve comprehension is removed.
              Wide or narrow reading width. Dark and light mode. A table of contents when the document warrants
              one. Code blocks that don&apos;t break. Nothing more.
            </p>

            <p>
              For teams that want more — custom URLs, version history, analytics, password protection,
              API access, and a CI integration to publish directly from a repository — signing in unlocks all of
              that, free. (Pages are permanent either way, account or not.)
            </p>

            <p>
              {APP_NAME} is built and maintained by{" "}
              <a
                href="https://ashwinsathian.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Ashwin Sathian
              </a>
              . It runs on Next.js and MongoDB.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href={ROUTES.app}
              className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-soft transition"
            >
              Try {APP_NAME}
              <svg width="11" height="11" fill="none" viewBox="0 0 12 12" aria-hidden>
                <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/api-docs" className="text-sm text-text-muted hover:text-text-primary transition">
              API docs →
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
