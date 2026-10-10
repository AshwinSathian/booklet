import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description:
    `${APP_NAME} publishes Markdown as web pages, with document types, links and team spaces for incident reports, ADRs, RFCs and runbooks. Who builds it and why.`,
  pathname: "/about",
});

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">About</p>
          <h1 className="text-[clamp(26px,4vw,36px)] text-text-primary mb-6 font-display">
            About {APP_NAME}
          </h1>

          <div className="prose-sm text-text-secondary flex flex-col gap-5 leading-relaxed">
            <p>
              {APP_NAME} started from a simple frustration. Sharing technical writing &mdash; an incident
              report, an architecture decision, release notes &mdash; meant either pasting raw Markdown into
              Slack, or opening a doc tool and then fighting its formatting and its access settings.
            </p>

            <p>
              So {APP_NAME} does one thing. You write Markdown, and it gives you a page with a link. You
              don&apos;t need an account to try it, and there are no ads on it.
            </p>

            <p>
              It has since grown towards the documents engineering teams pass around: incident reports,
              ADRs, RFCs, runbooks. A document can carry its type, status and owners. One can link to
              another. And a team can keep them in a space of its own, with some pages kept to its members.
            </p>

            <p>
              The page itself is plain on purpose. A reading width you can change, dark and light themes,
              a table of contents when the document is long enough to need one, code blocks that don&apos;t
              break. That&apos;s about it.
            </p>

            <p>
              All of it is free. Without an account you can publish ten pages a month and each is kept for
              90 days; sign in and both limits go away. Who pays for it, where it runs and how it&apos;s
              backed up are on the{" "}
              <Link href="/trust" className="text-accent underline underline-offset-2">
                Trust page
              </Link>
              .
            </p>

            <p>
              {APP_NAME} is built and maintained by{" "}
              <a
                href="https://ashwinsathian.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2"
              >
                Ashwin Sathian
              </a>
              . It runs on Next.js and MongoDB, and the source is on GitHub under AGPL-3.0.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href={ROUTES.app}
              className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-accent-contrast hover:bg-accent-soft transition"
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
