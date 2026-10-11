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
        {APP_NAME} started from a small frustration. Sharing technical writing, such as an incident report, an architecture
        decision or release notes, meant either pasting raw Markdown into a chat, or opening a document tool and then
        fighting its formatting and its access settings.
      </p>
      <p>
        So {APP_NAME} does one thing. You write Markdown, and it gives you a page with a link. You do not need an account to
        try it, and there are no ads on it.
      </p>

      <h2>What it grew into</h2>
      <p>
        It has since grown towards the documents engineering teams pass around: incident reports, ADRs, RFCs, runbooks. A
        document can carry its type, status and owners. One can link to another. And a team can keep them in a space of its
        own, with some pages kept to its members.
      </p>
      <p>
        The page itself is plain on purpose. A reading width you can change, dark and light themes, a table of contents when
        the document is long enough to need one, code blocks that do not break.
      </p>

      <h2>What it costs</h2>
      <p>
        Nothing. Without an account you can publish ten pages a month and each is kept for 90 days; sign in and both limits
        go away. Who pays for it, where it runs and how it is backed up are on the <Link href="/trust">Trust page</Link>.
      </p>

      <h2>Who makes it</h2>
      <p>
        {APP_NAME} is built and maintained by{" "}
        <a href="https://ashwinsathian.com" target="_blank" rel="noopener noreferrer">
          Ashwin Sathian
        </a>
        . It runs on Next.js and MongoDB, and the{" "}
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
