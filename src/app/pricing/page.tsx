import { Container, Mark, PageShell, PageTitle } from "@/components/marketing/primitives";
import { Button } from "@/components/ui/Button";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = buildMetadata({
  title: "Free, with no paid plan",
  description:
    "Booklet is free and has no paid plan. What you can do without an account, what a free account adds, and who pays for the hosting.",
  pathname: "/pricing",
});

const ROWS: Array<[string, string, string]> = [
  ["Pages a month", "10", "No cap"],
  ["How long a page is kept", "90 days", "Until you delete it"],
  ["Change a page after publishing", "No", "Yes, at the same link"],
  ["Custom address (slug)", "No", "Yes"],
  ["Version history", "No", "50 versions a page, with compare and restore"],
  ["Views and read depth", "No", "Yes"],
  ["Password on a page", "No", "Yes"],
  ["Team spaces and team-only pages", "No", "Yes"],
  ["API, CLI and GitHub workflows", "No", "Yes"],
  ["Claude and other MCP clients", "No", "Yes"],
  ["Webhooks", "No", "Yes, five"],
  ["Links between documents", "No", "Yes"],
  ["Document types, export, themes", "Yes", "Yes"],
];

export default function PricingPage() {
  return (
    <PageShell>
      <Container className="py-14 sm:py-20">
        <PageTitle
          eyebrow="Pricing"
          title={
            <>
              Free, and there is <Mark>no paid plan</Mark>.
            </>
          }
          lede={
            <>
              Every feature of {APP_NAME} comes with a free account. Nothing asks for a card. The maintainer pays for the
              hosting, and the{" "}
              <Link href="/trust" className="text-text-primary underline underline-offset-4">
                Trust page
              </Link>{" "}
              says what that hosting is.
            </>
          }
        />

        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="primary" size="lg" href={ROUTES.app}>
            Write a page
          </Button>
          <Button variant="secondary" size="lg" href={ROUTES.signUp}>
            Create a free account
          </Button>
        </div>

        <div className="mt-14 max-w-4xl">
          <table className="w-full table-fixed border-collapse text-left text-sm sm:text-[15px]">
            <caption className="sr-only">What you can do without an account and with a free account</caption>
            <thead>
              <tr className="border-b border-border-strong">
                <th scope="col" className="py-3 pr-4 font-normal text-text-muted">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="w-[24%] py-3 pr-3 align-bottom font-display text-base font-medium sm:text-lg">
                  Without an account
                </th>
                <th scope="col" className="w-[36%] py-3 align-bottom font-display text-base font-medium sm:text-lg">
                  With a free account
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([feature, without, withAccount]) => (
                <tr key={feature} className="border-b border-border-default">
                  <th scope="row" className="py-3.5 pr-3 align-top font-medium text-text-primary">
                    {feature}
                  </th>
                  <td className={`py-3.5 pr-3 align-top ${without === "No" ? "text-text-muted" : "text-text-secondary"}`}>{without}</td>
                  <td className="py-3.5 align-top text-text-secondary">{withAccount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="prose-typeset mt-8 max-w-2xl leading-relaxed text-text-secondary">
          A page published without an account can be kept: open it in the browser you published it from, sign in, and choose
          &ldquo;Keep this page&rdquo;. The exact numbers are in <Link href="/docs/reference/limits">Limits</Link>.
        </p>
      </Container>
    </PageShell>
  );
}
