import { Container, PageShell, PageTitle } from "@/components/marketing/primitives";
import { APP_NAME } from "@/lib/constants";
import { RELEASES, type Entry, type Release } from "@/lib/changelog";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "Changelog",
  description: `What changed in ${APP_NAME}, release by release: what is new, what was improved, fixed and removed.`,
  pathname: "/changelog",
});

const ORDER: Entry["tag"][] = ["New", "Improved", "Fixed", "Removed"];

function Entries({ release }: { release: Release }) {
  return (
    <div className="mt-6 flex flex-col gap-7">
      {ORDER.map((tag) => {
        const entries = release.entries.filter((e) => e.tag === tag);
        if (!entries.length) return null;
        return (
          <div key={tag} className="grid gap-x-8 gap-y-2 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
            <h3 className="pt-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{tag}</h3>
            <ul className="flex flex-col gap-2.5">
              {entries.map((entry) => (
                <li key={entry.text} className="leading-relaxed text-text-secondary">
                  {entry.text}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ReleaseDate({ date }: { date: string }) {
  return (
    <time dateTime={date} className="font-mono text-xs text-text-muted">
      {new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
    </time>
  );
}

export default function ChangelogPage() {
  const [latest, ...older] = RELEASES;
  return (
    <PageShell>
      <Container className="py-14 sm:py-20">
        <PageTitle eyebrow="Changelog" title={`What changed in ${APP_NAME}`} />

        <div className="mt-12 max-w-3xl">
          <section className="border-t border-border-strong pt-8">
            <ReleaseDate date={latest.date} />
            <h2 className="mt-2 font-display text-3xl font-medium">
              <span className="mark">{latest.version}</span>
            </h2>
            <p className="mt-3 text-lg leading-relaxed text-text-primary">{latest.summary}</p>
            <Entries release={latest} />
          </section>

          <div className="mt-14 border-b border-border-default">
            {older.map((release) => (
              <details key={release.version} className="group border-t border-border-default">
                <summary className="flex cursor-pointer list-none items-baseline gap-4 py-5 [&::-webkit-details-marker]:hidden">
                  <h2 className="w-36 shrink-0 font-display text-xl font-medium">{release.version}</h2>
                  <span className="flex-1 text-[15px] leading-relaxed text-text-secondary">{release.summary}</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0 translate-y-0.5 group-open:rotate-45">
                    <path d="M7 1.5v11M1.5 7h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </summary>
                <div className="pb-8">
                  <ReleaseDate date={release.date} />
                  <Entries release={release} />
                </div>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </PageShell>
  );
}
