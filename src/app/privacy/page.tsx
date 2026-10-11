import { APP_NAME } from "@/lib/constants";
import { enabledSsoProviders } from "@/lib/auth/sso";
import { ANONYMOUS_LIMITS } from "@/lib/quota";
import { ProsePage } from "@/components/marketing/primitives";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "Privacy policy",
  description: `Privacy policy for ${APP_NAME}: what we store, why, and how to delete it.`,
  pathname: "/privacy",
  noIndex: false,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function PrivacyPage() {
  // Only the providers this deployment has configured are named.
  const providers = enabledSsoProviders();
  const providerNames = providers.map((p) => p.label).join(" or ");
  return (
    <ProsePage eyebrow="Legal" title="Privacy policy" lede="Last updated: October 2026">
          <Section title="What we store">
            <p>
              <strong className="text-text-primary">Publishing without an account.</strong> Your page is stored in a
              MongoDB database on the machine {APP_NAME} runs on. It is served for 90 days and deleted 30 days after
              that, unless you sign in and choose Keep this page. A cookie is set in the browser you published from,
              for 120 days, so that only that browser can keep the page later. To enforce the cap of{" "}
              {ANONYMOUS_LIMITS.pagesPerMonth} pages a month, we store the IP address you publish from with a
              counter, which is deleted early the following month. Rate limits on publishing, sign-in, page passwords,
              reports and analytics also keep the IP address (and, for sign-in, the email address typed) with a counter
              for about two minutes.
            </p>
            <p>
              <strong className="text-text-primary">Accounts.</strong> We store your email address and an argon2id hash
              of your password, never the password itself. We email you a link to confirm the address. Signing in
              issues a random session token. The server stores a hash of it; the token itself is in an httpOnly cookie
              in your browser. If you add a passkey, we store its public key; the private key stays on your device.
              {providers.length > 0 && (
                <>
                  {" "}If you sign in with {providerNames}, we receive your account ID there and your verified email
                  address, and nothing else: no profile, contacts or repositories.
                </>
              )}
            </p>
            <p>
              <strong className="text-text-primary">Team spaces.</strong> A space stores the email address of each
              member. An invited address is not stored until that person joins: it is carried in the invite link and
              in the email sent to it. When the owner removes a member, the space keeps that address so that the
              invites sent to it earlier stop working.
            </p>
            <p>
              <strong className="text-text-primary">Analytics on a page.</strong> We count views, whether a reader
              reached half way and the end, clicks on the page&apos;s link to the editor, the kind of site a reader came
              from (not its address), and an approximate country taken from Cloudflare&apos;s headers. To count a reader
              once a day we store a one-way hash of their IP address, browser user agent and the date; the IP address
              itself is not stored with analytics. The page&apos;s owner sees its views, reading depth, kinds of referrer
              and countries. The administrator sees totals for the whole site, not per reader. No third-party analytics
              script runs on any {APP_NAME} page.
            </p>
            <p>
              <strong className="text-text-primary">API keys and webhooks.</strong> An API key is shown once and then
              stored as a hash. A webhook stores the address you gave it and a log of its last 50 deliveries.
            </p>
          </Section>

          <Section title="How we use it">
            <p>
              Only to run the service: to store and serve your pages, tie them to your account, and show you the
              numbers above. We email you a link to confirm your address, a password-reset link when you ask for
              one, a link to a new address when you change it, a notice to the old address after the change, and an
              invite when someone invites you to a team space. We send no marketing email.
            </p>
            <p>We do not serve ads, sell your data, or use your content to train AI models.</p>
          </Section>

          <Section title="Cookies and local storage">
            <p>
              {APP_NAME} saves your editor drafts in the browser&apos;s <strong className="text-text-primary">localStorage</strong>.
              Drafts stay on your device unless you publish them or sign in, which syncs them to your account. The
              cookies are all first-party: one httpOnly session cookie while you are signed in; short-lived cookies
              while a provider or passkey sign-in is in progress; the cookie described above after you publish without
              an account; and, after you enter a page&apos;s password, a cookie that keeps that page open in that browser
              for 8 hours. There are no third-party or tracking cookies.
            </p>
          </Section>

          <Section title="Keeping and deleting">
            <p>
              A page under an account is stored until you delete it, which you can do from My pages. Delete your
              account, and everything in it, from Account settings; if you cannot sign in, email{" "}
              <a href="mailto:booklet@ashwinsathian.com" className="link">
                booklet@ashwinsathian.com
              </a>
              . A page an administrator took down for breaking the terms is kept after its owner&apos;s account is
              deleted, so that its address cannot be reused.
            </p>
            <p>
              The database is backed up every night and 30 nightly archives are kept, so a deleted page or account
              remains in those archives until 30 newer ones have replaced them, normally 30 nights. If you report a page, we store the report and, if you
              give one, your email address.
            </p>
          </Section>

          <Section title="Other companies involved">
            <ul className="list-disc list-outside pl-5 flex flex-col gap-1.5">
              <li><strong className="text-text-primary">Cloudflare.</strong> Its network and tunnel sit in front of the machine {APP_NAME} runs on, so it carries every request</li>
              <li><strong className="text-text-primary">Resend.</strong> It delivers our email, and so receives the address of anyone we write to (see above) and the text of an abuse report, with the reporter&apos;s address if they gave one</li>
              {providers.length > 0 && (
                <li><strong className="text-text-primary">{providerNames}.</strong> Only if you choose to sign in with one. It learns that you signed in to {APP_NAME}</li>
              )}
              {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                <li><strong className="text-text-primary">Cloudflare Turnstile.</strong> A robot check on publishing without an account, creating an account and reporting a page. It runs in your browser and sends Cloudflare your IP address and browser signals</li>
              )}
            </ul>
          </Section>

          <Section title="Contact">
            <p>
              Questions? Email{" "}
              <a href="mailto:booklet@ashwinsathian.com" className="link">
                booklet@ashwinsathian.com
              </a>
              .
            </p>
          </Section>
    </ProsePage>
  );
}
