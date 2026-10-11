import { ProsePage } from "@/components/marketing/primitives";
import { Button } from "@/components/ui/Button";
import { APP_NAME, REPO_URL, ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description: `${APP_NAME} publishes Markdown as web pages, with document types, links and team spaces for incident reports, ADRs, RFCs and runbooks. Who builds it and why.`,
  pathname: "/about",
});

export default function AboutPage() {
  return (
    <ProsePage eyebrow="About" title={`Why ${APP_NAME} exists`}>
      <p>
        {APP_NAME} began as a way to send technical writing (an incident report, an architecture decision, release notes)
        without pasting raw Markdown into a chat or setting up a document tool&apos;s formatting and access. You write
        Markdown and get a page with a link. You do not need an account to try it, and it carries no ads.
      </p>

      <h2>What it grew into</h2>
      <p>
        It has since grown towards the documents engineering teams pass around: incident reports, ADRs, RFCs, runbooks. A
        document can carry its type, status and owners and link to other documents, and a team can keep its documents in
        a space, with some pages limited to members.
      </p>
      <p>
        The page is plain on purpose: a normal or wide reading width, dark and light themes, and a table of contents once
        a document has three headings.
      </p>

      <h2>What it costs</h2>
      <p>
        Nothing. Without an account you can publish 10 pages a month and each is served for 90 days; sign in and both limits
        go away. Who runs it and how it is backed up are on the <Link href="/trust">Trust page</Link>.
      </p>

      <h2>Who makes it</h2>
      <p>
        {APP_NAME} is built and maintained by{" "}
        <a href="https://ashwinsathian.com" target="_blank" rel="noopener noreferrer">
          Ashwin Sathian
        </a>
        . The{" "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          source is on GitHub
        </a>{" "}
        under AGPL-3.0.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button variant="primary" size="lg" href={ROUTES.app}>
          Write a page
        </Button>
        <Button variant="secondary" size="lg" href={ROUTES.docs}>
          Read the docs
        </Button>
      </div>
    </ProsePage>
  );
}
