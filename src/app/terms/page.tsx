import { AppLogo } from "@/components/ui/AppLogo";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description: `Terms of service for ${APP_NAME} — the rules for using the platform.`,
  pathname: "/terms",
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

export default function TermsPage() {
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
        <div className="max-w-2xl flex flex-col gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-3">Legal</p>
            <h1 className="text-[clamp(22px,3.5vw,30px)] text-text-primary mb-2">Terms of Service</h1>
            <p className="text-sm text-text-muted">Last updated: May 2026</p>
          </div>

          <Section title="Acceptance">
            <p>
              By using {APP_NAME} (&quot;the Service&quot;), you agree to these terms. If you do not agree, do not use the Service.
            </p>
          </Section>

          <Section title="What you can do">
            <p>
              You may use {APP_NAME} to publish, share, and manage Markdown documents for any lawful purpose.
              You retain full ownership of any content you publish — we claim no intellectual property rights over your work.
            </p>
          </Section>

          <Section title="What you may not do">
            <p>You may not use the Service to publish content that:</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5">
              <li>Violates applicable laws or regulations</li>
              <li>Infringes the intellectual property rights of others</li>
              <li>Contains malware, phishing material, or deceptive content</li>
              <li>Harasses, threatens, or discriminates against individuals or groups</li>
              <li>Distributes spam or unsolicited commercial messages</li>
            </ul>
            <p>
              We reserve the right to remove content that violates these terms and to suspend accounts that repeatedly
              do so.
            </p>
          </Section>

          <Section title="Anonymous pages">
            <p>
              Pages published without an account are stored for 30 days and then automatically deleted. We make
              no guarantees about the availability or persistence of anonymous pages beyond that window.
            </p>
          </Section>

          <Section title="API and programmatic access">
            <p>
              API access is subject to the rate limits described in the{" "}
              <Link href="/api-docs" className="text-accent hover:underline">API reference</Link>. Automated
              scraping, abuse, or attempts to circumvent rate limits may result in key revocation.
            </p>
          </Section>

          <Section title="Availability">
            <p>
              The Service is provided &quot;as is&quot; without any uptime guarantee. We may modify, suspend, or
              discontinue features at any time. We will make reasonable efforts to communicate significant changes.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the maximum extent permitted by law, {APP_NAME} and its operators are not liable for any indirect,
              incidental, or consequential damages arising from your use of the Service, including data loss.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms from time to time. Material changes will be communicated via the website.
              Continued use of the Service after changes constitutes acceptance.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Email{" "}
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
            <Link href="/privacy" className="hover:text-text-primary transition">Privacy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
