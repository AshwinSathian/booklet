import { AppLogo } from "@/components/ui/AppLogo";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { enabledSsoProviders } from "@/lib/auth/sso";
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
      <h2 className="text-base text-text-primary border-b border-border-default pb-2">{title}</h2>
      <div className="flex flex-col gap-3 text-sm text-text-secondary leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  // Only the providers this deployment has configured are named.
  const providers = enabledSsoProviders();
  const providerNames = providers.map((p) => p.label).join(" or ");
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-3xl px-4 h-12 flex items-center justify-between gap-4">
          <AppLogo onlyIcon={false} />
          <Link
            href={ROUTES.app}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-pill border border-border-default px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
          >
            Open editor
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
        <div className="max-w-2xl flex flex-col gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Legal</p>
            <h1 className="text-[clamp(22px,3.5vw,30px)] text-text-primary mb-2 font-display">Privacy Policy</h1>
            <p className="text-sm text-text-muted">Last updated: October 2026</p>
          </div>

          <Section title="What we collect">
            <p>
              <strong className="text-text-primary">Anonymous visitors</strong> — When you publish a page without signing in,
              your content is stored in our database (MongoDB). The page is served for 90 days and deleted 30 days
              after that, unless you sign in and claim it. We store no personal data alongside it. A cookie is
              set in the browser you published from so that only that browser can claim the page later; we do
              not track you across sites.
              Anonymous publishing is capped at {ANONYMOUS_LIMITS.pagesPerMonth} pages per month per IP address to
              keep the service sustainable for everyone; signing in removes that cap.
            </p>
            <p>
              <strong className="text-text-primary">Signed-in accounts</strong> — When you create an account, we store your
              email address and a salted, memory-hard hash of your password (argon2id) — never the password itself.
              We email you a link to confirm the address. Signing in issues a random session token, stored
              server-side and referenced only by an httpOnly cookie in your browser. If you add a passkey, we
              store its public key; the private key never leaves your device.
              {providers.length > 0 && (
                <>
                  {" "}If you sign in with {providerNames}, we receive your account ID there and your verified email
                  address, and nothing else: no profile, contacts or repositories.
                </>
              )}
              {" "}You can download your pages or delete your account, with everything in it, from Account settings.
            </p>
            <p>
              <strong className="text-text-primary">Page analytics</strong> — We count views, track scroll depth (50% and 100%
              read events), record HTTP referrers, and infer approximate country from Cloudflare headers. This
              data is attached to individual pages and accessible only to the page owner. We do not sell analytics
              data or use it for advertising. No third-party analytics script runs on any {APP_NAME} page.
            </p>
            <p>
              <strong className="text-text-primary">API keys</strong> — If you generate API keys, the raw key is shown once and
              then hashed. We store only the hash.
            </p>
          </Section>

          <Section title="How we use your data">
            <p>We use collected data solely to operate the service: storing and serving your pages, associating
              pages with your account, and delivering analytics you asked for. The only email we send you is a password-reset link
              when you ask for one. We send no marketing email.</p>
            <p>We do not serve ads, sell your data to third parties, or use your content to train AI models.</p>
          </Section>

          <Section title="Cookies and local storage">
            <p>
              {APP_NAME} uses browser <strong className="text-text-primary">localStorage</strong> to save your editor drafts
              locally. Drafts stay on your device unless you publish them, or sign in, which syncs them to your
              account. We use one first-party, httpOnly session cookie for signed-in auth, and short-lived
              first-party cookies while a provider or passkey sign-in is in progress. We do not use
              third-party tracking cookies.
            </p>
          </Section>

          <Section title="Data retention and deletion">
            <p>
              Pages under an account are stored until you delete them, which you can do at any time from the
              My Pages dashboard. Pages published without an account stop being served after 90 days and are
              deleted 30 days later; to have one removed sooner, contact us. If you report a page, we store
              the report and, if you give one, your email address.
            </p>
            <p>
              To delete your account and all associated data, email{" "}
              <a href="mailto:hello@booklet.ashwinsathian.com" className="text-accent hover:underline">
                hello@booklet.ashwinsathian.com
              </a>
              . We will process your request within 30 days.
            </p>
          </Section>

          <Section title="Third-party services">
            <p>We keep this list short by design. Sessions and all page data are handled on infrastructure we run
              ourselves.</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5">
              <li><strong className="text-text-primary">Cloudflare</strong> — edge network and tunnel in front of our servers</li>
              <li><strong className="text-text-primary">Resend</strong> — delivers our email. It receives your email address when you create an account or request a password reset, and the text of an abuse report (with your email address, if you gave one) when you report a page</li>
              {providers.length > 0 && (
                <li><strong className="text-text-primary">{providerNames}</strong> — only if you choose to sign in with one. It learns that you signed in to {APP_NAME}</li>
              )}
              {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                <li><strong className="text-text-primary">Cloudflare Turnstile</strong> — a robot check on publishing without an account, creating an account and reporting a page. It runs in your browser and sends Cloudflare your IP address and browser signals</li>
              )}
              <li><strong className="text-text-primary">MongoDB</strong> — self-hosted primary database for all page and account records, including anonymous pages</li>
            </ul>
          </Section>

          <Section title="Contact">
            <p>
              Questions? Email{" "}
              <a href="mailto:hello@booklet.ashwinsathian.com" className="text-accent hover:underline">
                hello@booklet.ashwinsathian.com
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
