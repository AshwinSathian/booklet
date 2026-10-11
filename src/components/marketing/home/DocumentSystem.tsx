import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { Card, Section } from "@/components/marketing/primitives";
import { DocHeaderStrip } from "@/components/share/DocHeaderStrip";
import { ReferencedByList } from "@/components/share/ReferencedByList";
import { SpaceGroups } from "@/components/share/SpaceGroups";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import type { DbPage } from "@/lib/db/types";
import { parseToBlocks } from "@/lib/parse";
import { groupSpacePages } from "@/lib/space-groups";
import Link from "next/link";
import type { ReactNode } from "react";

function Row({ title, body, href, link, visual, flip }: { title: string; body: ReactNode; href: string; link: string; visual: ReactNode; flip?: boolean }) {
  return (
    <div className="grid items-center gap-8 border-t border-border-default py-10 first:border-t-0 first:pt-0 last:pb-0 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : ""}>
        <h3 className="font-display text-h3 font-medium">{title}</h3>
        <div className="mt-3 text-[1.0625rem] leading-relaxed text-text-secondary">{body}</div>
        <Link href={href} className="mt-5 inline-block text-sm font-semibold underline decoration-highlight decoration-[3px] underline-offset-[5px] hover:decoration-accent">
          {link}
        </Link>
      </div>
      <div className={flip ? "lg:order-1" : ""}>{visual}</div>
    </div>
  );
}

const code = "rounded bg-bg-soft px-1.5 py-0.5 font-mono text-[0.9em] text-text-primary";
const caption = "mb-3 text-xs font-medium text-text-muted";

// The sample pages of a team space. They are the documents the product shot
// above plays, plus two more, so every title on this page names the same
// few documents. Grouped and ordered by groupSpacePages, as a real space is.
const page = (id: string, title: string, doc_type: DbPage["doc_type"], status: string, date: string, visibility: DbPage["visibility"] = "public"): DbPage => ({
  id,
  slug: id,
  title,
  doc_type,
  visibility,
  user_id: "sample",
  collection_id: "sample",
  team_id: null,
  view_count: 0,
  password_hash: null,
  taken_down_at: null,
  frontmatter_meta: { status, date },
  created_at: `${date}T00:00:00.000Z`,
  updated_at: `${date}T00:00:00.000Z`,
});
const SPACE_PAGES: DbPage[] = [
  page("adr-012-queue-retries", "ADR-012 Queue retries", "adr", "Accepted", "2026-08-02"),
  page("adr-007-retry-in-the-client", "ADR-007 Retry in the client", "adr", "Superseded", "2026-03-11", "team"),
  page("checkout-incident-07-18", "Checkout API errors, 18 July", "incident", "Resolved", "2026-07-18"),
  page("delayed-payouts-06-02", "Delayed payouts, 2 June", "incident", "Resolved", "2026-06-02"),
];

// One sentence of ADR-012, with its link as the published page has it.
const LINKING_SENTENCE = parseToBlocks("One caller has no limit: see [Delayed payouts, 2 June](/p/delayed-payouts-06-02).");

/**
 * Three things a page carries besides its text. Each is drawn by the
 * component the published site uses (the header strip, the renderer and the
 * "Referenced by" list, a team space's page list) from sample data, so what
 * a visitor sees here is what the product draws.
 */
export function DocumentSystem() {
  return (
    <Section
      eyebrow="For engineering teams"
      title="What a page carries besides the text"
      lede="A page shows its type and status, links to the documents it names, and can be limited to a team."
    >
      <Row
        title="A document says what it is"
        body={
          <p>
            Put <code className={code}>type: incident</code> in the frontmatter, or <code className={code}>adr</code>,{" "}
            <code className={code}>rfc</code>, <code className={code}>runbook</code>. The page shows its status, severity,
            date and owners in a strip above the title, so a reader knows in one line whether it is still open.
          </p>
        }
        href="/docs/guides/document-types"
        link="Document types"
        visual={
          <Card className="p-6 sm:p-7">
            <div inert data-sample>
              <DocHeaderStrip
                userId={null}
                meta={{ type: "incident", status: "Resolved", severity: "P1", date: "2026-07-18", owners: ["payments-oncall"] }}
              />
              <BlockRenderer
                blocks={parseToBlocks("# Checkout API errors, 18 July\n\nAbout 8% of checkout requests failed for 32 minutes.")}
                settings={DEFAULT_SETTINGS}
                headingOffset={2}
              />
            </div>
          </Card>
        }
      />
      <Row
        flip
        title="Documents link to each other"
        body={
          <p>
            Write <code className={code}>[[Delayed payouts, 2 June]]</code> in an ADR and it becomes a link to that
            incident report when you publish. The incident report then lists the ADR under &ldquo;Referenced by&rdquo;, for
            readers who are allowed to find it.
          </p>
        }
        href="/docs/guides/linking"
        link="Linking documents"
        visual={
          <Card className="p-6 sm:p-7">
            <div inert data-sample>
              <p className={caption}>In ADR-012 Queue retries</p>
              <BlockRenderer blocks={LINKING_SENTENCE} settings={DEFAULT_SETTINGS} />
              <p className={`${caption} mt-8`}>At the foot of Delayed payouts, 2 June</p>
              <div className="[&>nav]:mt-0">
                <ReferencedByList pages={[{ id: "adr-012", slug: "adr-012-queue-retries", title: "ADR-012 Queue retries" }]} />
              </div>
            </div>
          </Card>
        }
      />
      <Row
        title="A team keeps them in one space"
        body={
          <p>
            A team space lists its pages by type: incidents by date, a decision log in ADR-number order, then RFCs and
            runbooks. Invite a colleague by email address. A page limited to the team opens for members and answers 404
            for everyone else.
          </p>
        }
        href="/docs/guides/team-spaces"
        link="Team spaces"
        visual={
          <Card className="p-6 sm:p-7">
            <div inert data-sample className="[&>div]:space-y-7">
              <SpaceGroups groups={groupSpacePages(SPACE_PAGES)} />
            </div>
          </Card>
        }
      />
    </Section>
  );
}
