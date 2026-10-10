import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { APP_NAME, REPO_URL, ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = buildMetadata({
  title: "Trust",
  description: `Who runs ${APP_NAME}, where it is hosted, how it is backed up, and how to take your pages out or delete your account.`,
  pathname: "/trust",
});

// Both are read at build time (this page is static). A sentence that needs
// one is left out when it is unset.
const ABUSE_EMAIL = process.env.ABUSE_REPORT_EMAIL?.trim() || null;
const STATUS_PAGE_URL = process.env.NEXT_PUBLIC_STATUS_PAGE_URL?.trim() || null;

const link = "text-accent underline underline-offset-2";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base text-text-primary border-b border-border-default pb-2">{title}</h2>
      <div className="flex flex-col gap-3 text-sm text-text-secondary leading-relaxed">{children}</div>
    </section>
  );
}

export default function TrustPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <div className="max-w-2xl flex flex-col gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Trust</p>
            <h1 className="text-[clamp(22px,3.5vw,30px)] text-text-primary mb-2 font-display">
              What you&apos;re trusting when you publish here
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              {APP_NAME} is a small service, and you should know how small before you put an incident
              report on it. This page says who runs it, where your pages live, and how you get them out.
            </p>
          </div>

          <Section title="Who runs it">
            <p>
              One person:{" "}
              <a href="https://ashwinsathian.com" target="_blank" rel="noopener noreferrer" className={link}>
                Ashwin Sathian
              </a>
              . There is no company behind {APP_NAME} and no team on call.
            </p>
          </Section>

          <Section title="Where it is hosted">
            <p>
              On one Mac, behind a Cloudflare Tunnel. The app and its MongoDB database are on that same
              machine. If the Mac loses power or its internet connection, every page is unreachable until
              it comes back, and after a restart someone has to sign in to it by hand.
            </p>
            <p>
              A move to hosted infrastructure was looked at in October 2026 and put off. The measurements
              and the reasons are in{" "}
              <a href={`${REPO_URL}/blob/main/docs/adr/0001-hosting-platform.md`} target="_blank" rel="noopener noreferrer" className={link}>
                ADR 0001
              </a>
              .
            </p>
          </Section>

          <Section title="Backups">
            <p>
              The database is dumped every night at 03:30 and the last 30 archives are kept. Restoring
              from one has been tested. The archives are on the same disk as the database, so they cover
              a bad change or an accidental delete, and they do not cover losing the disk.
            </p>
          </Section>

          <Section title="Uptime">
            <p>
              A scheduled job on GitHub checks the site, the API and the MCP server every 10 minutes and
              emails the maintainer when one stops answering.{" "}
              {STATUS_PAGE_URL ? (
                <>
                  Current status is on the{" "}
                  <a href={STATUS_PAGE_URL} target="_blank" rel="noopener noreferrer" className={link}>
                    status page
                  </a>
                  .
                </>
              ) : (
                <>There is no public status page yet.</>
              )}
            </p>
          </Section>

          <Section title="Who pays for it">
            <p>
              The maintainer does. {APP_NAME} has no paid plan, no ads and no third-party analytics. It
              counts page views and how far readers scroll, and shows those numbers to the page&apos;s author.
            </p>
          </Section>

          <Section title="What is stored">
            <p>
              Your pages, their earlier versions, and drafts if you are signed in. Account passwords are
              stored as argon2id hashes. API keys and session tokens are stored as keyed hashes, so the
              database does not hold a usable copy of either.
            </p>
            <p>
              A new page is unlisted: anyone with the link can read it, and search engines are told not
              to index it. A page published without an account is deleted 90 days later unless you claim
              it. The <Link href="/privacy" className={link}>privacy policy</Link> has the rest.
            </p>
          </Section>

          <Section title="Taking your pages out, or leaving">
            <p>
              <Link href={ROUTES.account} className={link}>Account settings</Link> has a download of every
              page you own as a ZIP of Markdown files, frontmatter included. The same screen deletes the
              account, and with it your pages, versions, drafts, API keys and webhooks.
            </p>
          </Section>

          <Section title="Source and license">
            <p>
              The app is open source under AGPL-3.0. The CLI, the API client, the MCP server and the
              GitHub Action are MIT. You can read the code, or run your own copy, from{" "}
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={link}>
                the repository
              </a>
              .
            </p>
          </Section>

          <Section title="Reporting a page">
            <p>
              Every published page has a &ldquo;Report this page&rdquo; link in its footer. A page that
              is taken down stops being served and its address answers 410 Gone.
              {ABUSE_EMAIL ? (
                <>
                  {" "}
                  You can also write to{" "}
                  <a href={`mailto:${ABUSE_EMAIL}`} className={link}>
                    {ABUSE_EMAIL}
                  </a>
                  .
                </>
              ) : null}
            </p>
          </Section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
