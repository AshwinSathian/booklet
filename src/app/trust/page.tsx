import { APP_NAME, REPO_URL, ROUTES } from "@/lib/constants";
import { ProsePage } from "@/components/marketing/primitives";
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

const link = "link";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function TrustPage() {
  return (
    <ProsePage eyebrow="Trust" title="What you are trusting when you publish here" lede={`Who runs ${APP_NAME}, where your pages live, what is stored and how you get your pages out.`}>
          <Section title="Public beta">
            <p>
              Features can change, and there is no promise about how long {APP_NAME} runs or
              what notice you would get if it stopped. Keep your own copy of anything you cannot lose: the
              section on taking your pages out says how.
            </p>
          </Section>

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
              it comes back, and after a restart the maintainer has to sign in to it by hand.
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
              The database is dumped every night at 03:30, the machine&apos;s local time, and the last 30 archives are kept.
              Restoring from one has been tested. The archives are on the same disk as the database, so they
              cover a bad change or an accidental delete, and they do not cover losing the disk. A page or an
              account you delete stays in those archives until 30 newer ones have replaced them, which is 30 nights when
              no backup is missed.
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
              counts page views, how far readers scroll, the kind of site a reader came from and an approximate
              country, and shows those
              numbers to the page&apos;s author.
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
              to index it. A page published without an account stops being served after 90 days and is
              deleted 30 days after that, unless you sign in and choose Keep this page. The{" "}
              <Link href="/privacy" className={link}>privacy policy</Link> has the rest.
            </p>
          </Section>

          <Section title="Taking your pages out, or leaving">
            <p>
              <Link href={ROUTES.account} className={link}>Account settings</Link> has a download of every
              page you own as a ZIP of Markdown files, frontmatter included. The ZIP has each page as it is
              now: not its earlier versions, not your drafts, and not a page that was taken down. The same screen deletes the account, and with
              it your pages, versions, drafts, API keys and webhooks. A page that was taken down for breaking the
              terms is kept after its owner&apos;s account is deleted, so its address cannot be reused.
            </p>
          </Section>

          <Section title="Source and licence">
            <p>
              The app is open source under AGPL-3.0. The CLI, the API client, the MCP server and the
              GitHub Action are MIT. You can read the code, or run your own copy, from{" "}
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={link}>
                the repository
              </a>
              ; its README has a section on running your own. The action has a repository of its own. If you
              change the app and run it as a service for others, AGPL section 13 requires you to offer them your
              source.
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

          <Section title="Contact and security">
            <p>
              Write to{" "}
              <a href="mailto:booklet@ashwinsathian.com" className={link}>
                booklet@ashwinsathian.com
              </a>
              . If an error page showed you a reference code, include it. To report a vulnerability privately, follow{" "}
              <a href={`${REPO_URL}/blob/main/SECURITY.md`} target="_blank" rel="noopener noreferrer" className={link}>
                SECURITY.md
              </a>{" "}
              in the repository.
            </p>
          </Section>
    </ProsePage>
  );
}
