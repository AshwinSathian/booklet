import { Container, Section } from "@/components/marketing/primitives";
import { REPO_URL, ROUTES } from "@/lib/constants";
import Link from "next/link";
import type { ReactNode } from "react";

const FACTS: Array<{ title: string; body: ReactNode }> = [
  { title: "Free", body: "Every feature comes with a free account. There is no paid plan and nothing asks for a card." },
  { title: "Unlisted by default", body: "A new page can be read by anyone with the link and is kept out of search engines until you make it public." },
  {
    title: "Yours to take away",
    body: "Any page exports as Markdown or as one HTML file. Your account downloads every page as a ZIP, and deletes itself when you ask.",
  },
  {
    title: "Open source, run by one person",
    body: (
      <>
        The app is AGPL-3.0 and the{" "}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          source is public
        </a>
        . The <Link href="/trust">Trust page</Link> says who runs it, where, and how it is backed up.
      </>
    ),
  },
];

const FAQ: Array<{ q: string; a: ReactNode }> = [
  {
    q: "Do I need an account?",
    a: "No. Without one you can publish 10 pages a month, each kept for 90 days. A free account removes both limits and adds editing in place, custom slugs, version history, analytics, team spaces and API keys.",
  },
  {
    q: "Who can read a page I publish?",
    a: "Anyone with the link, so treat a link as something that can be forwarded. For a page that members of a team alone can open, publish it into a team space with Team visibility. A page can also have a password.",
  },
  {
    q: "Can I change a page after publishing it?",
    a: "With an account, yes. The link stays the same and each earlier version is kept, up to 50, with a line-by-line comparison and a restore.",
  },
  {
    q: "What Markdown does it render?",
    a: (
      <>
        GitHub-Flavored Markdown, KaTeX math, Mermaid and Graphviz diagrams, callouts, toggles and columns. Raw HTML is not
        rendered. The <Link href="/docs/reference/markdown">Markdown reference</Link> has the syntax.
      </>
    ),
  },
  {
    q: "What happens to my pages if Booklet goes away?",
    a: (
      <>
        Booklet is small, and the <Link href="/trust">Trust page</Link> says exactly how small. You can export everything at
        any time, and the source is there to run yourself.
      </>
    ),
  },
];

/** What you are trusting, the questions people ask, and the way in. */
export function Close() {
  return (
    <>
      <Section eyebrow="Plainly" title="What you get, and what you are trusting.">
        <dl className="prose-typeset grid gap-x-12 sm:grid-cols-2">
          {FACTS.map((fact) => (
            <div key={fact.title} className="border-t border-border-default py-5">
              <dt className="font-display text-xl font-medium">{fact.title}</dt>
              <dd className="mt-2 leading-relaxed text-text-secondary">{fact.body}</dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-12 font-display text-h3 font-medium">Questions</h3>
        <div className="prose-typeset mt-4 max-w-3xl border-b border-border-default">
          {FAQ.map((item) => (
            <details key={item.q} className="group border-t border-border-default">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.0625rem] font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0 group-open:rotate-45">
                  <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </summary>
              <p className="pb-6 pr-10 leading-relaxed text-text-secondary">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <section className="border-t border-border-default bg-accent py-16 text-accent-contrast sm:py-[4.5rem]">
        <Container className="text-center">
          <h2 className="mx-auto max-w-3xl font-display text-h2 font-medium text-balance">
            Publish the next incident report as a page.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg opacity-80">It takes a Markdown file and about a minute.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {/* On the ink band the buttons invert: the highlighter is the primary. */}
            <Link
              href={ROUTES.app}
              className="inline-flex h-12 items-center rounded-lg bg-highlight px-7 text-[15px] font-semibold text-on-highlight hover:brightness-95 focus-visible:ring-accent-contrast focus-visible:ring-offset-accent"
            >
              Write a page
            </Link>
            <Link
              href="/docs/quickstart"
              className="inline-flex h-12 items-center rounded-lg border border-accent-contrast/40 px-7 text-[15px] font-semibold text-accent-contrast hover:border-accent-contrast focus-visible:ring-accent-contrast focus-visible:ring-offset-accent"
            >
              Read the quickstart
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
