import { AppLogo } from "@/components/ui/AppLogo";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { ANONYMOUS_LIMITS } from "@/lib/quota";
import { buildMetadata } from "@/lib/seo";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: `Privacy policy for ${APP_NAME} — what data we collect, how we use it, and your rights.`,
  pathname: "/privacy",
  noIndex: false,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base text-text-primary border-b border-outline pb-2">{title}</h2>
      <div className="flex flex-col gap-3 text-sm text-text-secondary leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-3xl px-4 h-12 flex items-center justify-between gap-4">
          <AppLogo onlyIcon={false} />
          <Link
            href={ROUTES.app}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-pill border border-outline px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
          >
            Open editor
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <div className="max-w-2xl flex flex-col gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Legal</p>
            <h1 className="text-[clamp(22px,3.5vw,30px)] text-text-primary mb-2">Privacy Policy</h1>
            <p className="text-sm text-text-muted">Last updated: July 2026</p>
          </div>

          <Section title="What we collect">
            <p>
              <strong className="text-text-primary">Anonymous visitors</strong> — When you publish a page without signing in,
              your content is stored indefinitely in our database (MongoDB), the same as signed-in pages — there
              is no expiry. We store no personal data alongside it. A session token is issued to associate the
              page with your browser so you can see it in your history, but we do not track you across sites.
              Anonymous publishing is capped at {ANONYMOUS_LIMITS.pagesPerMonth} pages per month per IP address to
              keep the service sustainable for everyone; signing in removes that cap.
            </p>
            <p>
              <strong className="text-text-primary">Signed-in accounts</strong> — Authentication is handled entirely by us,
              with no third-party identity provider. When you create an account, we store your email address and a
              salted, memory-hard hash of your password (argon2id) — never the password itself. Signing in issues a
              random session token, stored server-side and referenced only by an httpOnly cookie in your browser.
            </p>
            <p>
              <strong className="text-text-primary">Page analytics</strong> — We count views, track scroll depth (50% and 100%
              read events), record HTTP referrers, and infer approximate country from Cloudflare headers. This
              data is attached to individual pages and accessible only to the page owner. We do not sell analytics
              data or use it for advertising.
            </p>
            <p>
              <strong className="text-text-primary">API keys</strong> — If you generate API keys, the raw key is shown once and
              then hashed. We store only the hash.
            </p>
          </Section>

          <Section title="How we use your data">
            <p>We use collected data solely to operate the service: storing and serving your pages, associating
              pages with your account, and delivering analytics you asked for. We do not currently send any
              transactional or marketing email.</p>
            <p>We do not serve ads, sell your data to third parties, or use your content to train AI models.</p>
          </Section>

          <Section title="Cookies and local storage">
            <p>
              {APP_NAME} uses browser <strong className="text-text-primary">localStorage</strong> to save your editor drafts
              locally — this data never leaves your device unless you publish. We use one first-party, httpOnly
              session cookie (issued directly by us, not a third party) for signed-in auth. We do not use
              third-party tracking cookies.
            </p>
          </Section>

          <Section title="Data retention and deletion">
            <p>
              Published pages are stored indefinitely. Signed-in users can delete their own pages at any time from
              the My Pages dashboard. Anonymous pages can be deleted by contacting us.
            </p>
            <p>
              To delete your account and all associated data, email{" "}
              <a href="mailto:hello@readable.ashwinsathian.com" className="text-accent hover:underline">
                hello@readable.ashwinsathian.com
              </a>
              . We will process your request within 30 days.
            </p>
          </Section>

          <Section title="Third-party services">
            <p>We keep this list short by design — authentication, sessions, and all page data are handled entirely
              on infrastructure we run ourselves, with no third-party identity or data processor in the loop.</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5">
              <li><strong className="text-text-primary">Cloudflare</strong> — edge network and tunnel in front of our servers</li>
              <li><strong className="text-text-primary">MongoDB</strong> — self-hosted primary database for all page and account records, including anonymous pages</li>
            </ul>
          </Section>

          <Section title="Contact">
            <p>
              Questions? Email{" "}
              <a href="mailto:hello@readable.ashwinsathian.com" className="text-accent hover:underline">
                hello@readable.ashwinsathian.com
              </a>
              .
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-border-subtle">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted">
          <span>© {new Date().getFullYear()} {APP_NAME}</span>
          <nav className="flex items-center gap-4">
            <Link href="/about" className="hover:text-text-primary transition">About</Link>
            <Link href="/terms" className="hover:text-text-primary transition">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
