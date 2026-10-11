import { Card, Section } from "@/components/marketing/primitives";
import { DocHeaderStrip, StatusChip } from "@/components/share/DocHeaderStrip";
import Link from "next/link";
import type { ReactNode } from "react";

function Row({ title, body, href, link, visual, flip }: { title: string; body: ReactNode; href: string; link: string; visual: ReactNode; flip?: boolean }) {
  return (
    <div className="grid items-center gap-8 border-t border-border-default py-12 first:border-t-0 first:pt-0 last:pb-0 lg:grid-cols-2 lg:gap-16">
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

/** Three things a plain Markdown page does not have, each shown with the component the product uses. */
export function DocumentSystem() {
  return (
    <Section
      eyebrow="For engineering teams"
      title="More than a rendered file."
      lede="A document knows what it is, what it refers to and who may read it."
    >
      <Row
        title="A document says what it is"
        body={
          <p>
            Put <code className={code}>type: incident</code> in the frontmatter, or <code className={code}>adr</code>,{" "}
            <code className={code}>rfc</code>, <code className={code}>runbook</code>. The page shows its status, severity,
            date and owners under the title, so a reader knows in one line whether it is still open.
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
              <p className="font-display text-2xl font-medium">Checkout API errors, 18 July</p>
              <p className="mt-2 text-text-secondary">About 8% of checkout requests failed for 32 minutes.</p>
            </div>
          </Card>
        }
      />
      <Row
        flip
        title="Documents link to each other"
        body={
          <p>
            Write <code className={code}>[[ADR-012 Queue retries]]</code> in an incident report and it becomes a link to
            that ADR when you publish. The ADR, in turn, lists every document that refers to it.
          </p>
        }
        href="/docs/guides/linking"
        link="Linking documents"
        visual={
          <Card className="p-6 sm:p-7">
            <div aria-hidden data-sample>
              <p className="text-[15px] leading-relaxed">
                The retry storm was possible because of the policy in{" "}
                <span className="font-medium underline decoration-highlight decoration-[3px] underline-offset-4">ADR-012 Queue retries</span>.
              </p>
              <div className="mt-6 border-t border-border-default pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">On ADR-012 · Referenced by</p>
                <ul className="mt-3 flex flex-col gap-2 text-[15px]">
                  <li className="underline underline-offset-4">Checkout API errors, 18 July</li>
                  <li className="underline underline-offset-4">Runbook: Queue backlog</li>
                </ul>
              </div>
            </div>
          </Card>
        }
      />
      <Row
        title="A team keeps them in one space"
        body={
          <p>
            A team space lists its pages by type: a decision log in ADR-number order, incidents by date, then RFCs and
            runbooks. Invite people by email. A page set to Team opens for members and answers 404 for everyone else.
          </p>
        }
        href="/docs/guides/team-spaces"
        link="Team spaces"
        visual={
          <Card className="overflow-hidden">
            <div aria-hidden data-sample>
              <div className="flex items-center justify-between border-b border-border-default px-5 py-3">
                <span className="font-display text-lg font-medium">Payments</span>
                <span className="font-mono text-xs text-text-muted">/t/payments</span>
              </div>
              {[
                {
                  group: "Decision log",
                  rows: [
                    ["ADR-012 Queue retries", "Accepted"],
                    ["ADR-011 One ledger per region", "Accepted"],
                    ["ADR-007 Retry in the client", "Superseded"],
                  ],
                },
                {
                  group: "Incidents",
                  rows: [
                    ["Checkout API errors, 18 July", "Resolved"],
                    ["Delayed payouts, 2 June", "Resolved"],
                  ],
                },
              ].map(({ group, rows }) => (
                <div key={group} className="px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{group}</p>
                  <ul className="mt-2 divide-y divide-border-subtle">
                    {rows.map(([title, status]) => (
                      <li key={title} className="flex items-center justify-between gap-4 py-2 text-[15px]">
                        <span className="truncate">{title}</span>
                        <StatusChip status={status} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        }
      />
    </Section>
  );
}
