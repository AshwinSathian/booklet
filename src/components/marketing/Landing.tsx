"use client";

import { AppLogo } from "@/components/ui/AppLogo";
import { trackEvent } from "@/lib/analytics";
import { APP_NAME, ROUTES } from "@/lib/constants";
import type { Easing, Variants } from "framer-motion";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Accordion, AccordionTab } from "primereact/accordion";
import { Button } from "primereact/button";
import React, { useMemo } from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as Easing },
  },
};

function Rule() {
  return <div className="h-px w-full bg-outline" />;
}

function Container({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4">{children}</div>;
}

function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <section id={id} className={cn("py-14 sm:py-20", className)}>
      <Container>
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-120px" }}
        >
          <motion.div variants={reduce ? undefined : fadeUp}>
            {eyebrow ? (
              <div className="text-[11px] tracking-[0.28em] text-text-muted">
                {eyebrow.toUpperCase()}
              </div>
            ) : null}

            <h2 className="mt-4 text-balance text-[28px] leading-[1.2] sm:text-[34px] font-semibold tracking-tight">
              {title}
            </h2>

            {subtitle ? (
              <p className="mt-4 text-pretty text-[15px] sm:text-[16px] leading-[1.7] text-text-secondary">
                {subtitle}
              </p>
            ) : null}
          </motion.div>

          <div className="mt-10">{children}</div>
        </motion.div>
      </Container>
    </section>
  );
}

function Card({
  title,
  desc,
  footer,
  className,
}: {
  title: string;
  desc?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-outline bg-bg-soft p-5 shadow-glass",
        className,
      )}
    >
      <div className="text-[15px] font-semibold tracking-tight">{title}</div>
      {desc ? (
        <div className="mt-2 text-[14px] leading-[1.7] text-text-secondary">
          {desc}
        </div>
      ) : null}
      {footer ? (
        <div className="mt-4 border-t border-outline pt-4 text-center">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-outline bg-bg-glass px-3 py-1 text-[12px] text-text-secondary">
      {children}
    </span>
  );
}

export function Landing() {
  const reduce = useReducedMotion();

  const steps = useMemo(
    () => [
      {
        title: "Paste your Markdown",
        desc: "Drop in notes, READMEs, incident updates, proposals — anything Markdown-shaped.",
      },
      {
        title: "Preview it instantly",
        desc: "Readable keeps headings, lists, tables, and code structured and calm.",
      },
      {
        title: "Publish a link",
        desc: "Get a clean, read-only page that looks good on phones and desktops.",
      },
      {
        title: "Share without friction",
        desc: "Send the link in Slack, email, or a ticket — your reader just reads.",
      },
    ],
    [],
  );

  const reasons = useMemo(
    () => [
      {
        title: "Markdown is great for writing. Not always for reading.",
        desc: "Readable is the small step between raw Markdown and “please open this tool to understand it.”",
      },
      {
        title: "A link that feels finished",
        desc: "Spacing, typography, and layout are handled for you — so your content lands the way you meant it.",
      },
      {
        title: "Built for forwarding",
        desc: "When your message gets copied into a thread or escalated, the structure stays intact.",
      },
      {
        title: "Opinionated, intentionally simple",
        desc: "No collaboration, no comments, no feeds. Just clean reading.",
      },
    ],
    [],
  );

  const useCases = useMemo(
    () => [
      {
        title: "Incident summaries",
        desc: "Timelines, impact, root cause, next steps — readable enough to forward.",
        footer: (
          <>
            <a
              target="_blank"
              href="https://readable.ashwinsathian.com/p/GqfTrJQg0t"
            >
              <Button
                label="View Readable Sample"
                size="small"
                className="min-w-full uppercase tracking-wide py-1"
                icon="pi pi-arrow-right"
                iconPos="right"
                text
                raised
                outlined
                onClick={() =>
                  trackEvent("example_clicked", { example: "incident" })
                }
              />
            </a>
          </>
        ),
      },
      {
        title: "Design notes & ADRs",
        desc: "Tradeoffs and decisions that make sense even to someone outside the repo.",
        footer: (
          <>
            <a
              target="_blank"
              href="https://readable.ashwinsathian.com/p/Vmm78unhPg"
            >
              <Button
                label="View Readable Sample"
                text
                raised
                outlined
                size="small"
                className="min-w-full uppercase tracking-wide py-1"
                icon="pi pi-arrow-right"
                iconPos="right"
                onClick={() =>
                  trackEvent("example_clicked", { example: "adr" })
                }
              />
            </a>
          </>
        ),
      },
      {
        title: "README-style docs",
        desc: "Documentation you can share without sending someone to GitHub first.",
        footer: (
          <>
            <a
              target="_blank"
              href="https://readable.ashwinsathian.com/p/6MTZfx3M6q"
            >
              <Button
                label="View Readable Sample"
                text
                raised
                outlined
                size="small"
                className="min-w-full uppercase tracking-wide py-1"
                icon="pi pi-arrow-right"
                iconPos="right"
                onClick={() =>
                  trackEvent("example_clicked", { example: "readme" })
                }
              />
            </a>
          </>
        ),
      },
    ],
    [],
  );

  return (
    <div className="relative min-h-screen bg-bg text-text-primary">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-outline bg-bg-glass/85 backdrop-blur">
        <Container>
          <div className="flex items-center justify-between py-3">
            <AppLogo />

            <div className="flex items-center gap-2">
              <Link href={ROUTES.app}>
                <Button
                  label="Try it now"
                  rounded
                  className="min-w-fit uppercase tracking-wide"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                  onClick={() =>
                    trackEvent("open_editor_clicked", { location: "topbar" })
                  }
                />
              </Link>
            </div>
          </div>
        </Container>
      </header>

      {/* HERO */}
      <Container>
        <div className="relative py-14 sm:py-20">
          {/* Decorative glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute -top-28 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-accent opacity-[0.12] blur-3xl" />
            <div className="absolute top-32 -right-20 h-56 w-56 rounded-full bg-accent opacity-[0.08] blur-3xl" />
          </div>

          <motion.div variants={container} initial="hidden" animate="show">
            <motion.div variants={reduce ? undefined : fadeUp}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>No signup</Badge>
                <Badge>Typography-first</Badge>
                <Badge>Share with a link</Badge>
              </div>

              <h1 className="mt-5 text-balance text-[38px] leading-[1.12] sm:text-[48px] font-bold tracking-tight">
                Make Markdown readable. Instantly.
              </h1>

              <p className="mt-4 max-w-2xl text-pretty text-[15px] sm:text-[16px] leading-[1.7] text-text-secondary">
                Paste your Markdown. {APP_NAME} turns it into a clean, shareable
                reading page — without asking your reader to open a repo, doc
                tool, or thread for context.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href={ROUTES.app}>
                  <Button
                    label="Try it now"
                    rounded
                    className="min-w-fit uppercase tracking-wide"
                    onClick={() =>
                      trackEvent("open_editor_clicked", { location: "hero" })
                    }
                  />
                </Link>
                <Button
                  label="See how it works"
                  className="min-w-fit uppercase tracking-wide"
                  severity="secondary"
                  outlined
                  onClick={() => {
                    const el = document.getElementById("how");
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
                <Button
                  label="See use cases"
                  className="min-w-fit uppercase tracking-wide"
                  severity="secondary"
                  outlined
                  onClick={() => {
                    const el = document.getElementById("use-cases");
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
                <div className="text-xs text-text-muted tracking-wide">
                  Tip: In the editor, press{" "}
                  <span className="font-semibold">⌘/Ctrl</span>+
                  <span className="font-semibold">Enter</span> to publish.
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </Container>

      {/* HERO PREVIEW */}
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-outline bg-bg-soft shadow-glass"
        >
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-outline bg-bg-glass">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="text-[12px] font-semibold">
                    Pasted Markdown
                  </div>
                  <div className="text-[11px] text-text-muted">raw</div>
                </div>
                <div className="h-px bg-outline" />
                <div className="max-h-80 overflow-auto p-4 font-mono text-[12px] leading-[1.65] text-text-secondary">
                  <pre className="whitespace-pre-wrap">{`## Incident Summary

Root cause analysis below:

- Service A timed out
- Retry logic failed
- Database pool exhausted

\`\`\`js
async function retry() {
  // ...
}
\`\`\``}</pre>
                </div>
              </div>

              <div className="rounded-xl border border-outline bg-bg">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="text-[12px] font-semibold">Readable page</div>
                  <div className="text-[11px] text-text-muted">clean</div>
                </div>
                <div className="h-px bg-outline" />
                <div className="p-4">
                  <div className="text-[18px] font-semibold tracking-tight">
                    Incident Summary
                  </div>
                  <div className="mt-2 text-[14px] leading-[1.7] text-text-secondary">
                    Ready to forward. Easy to read. Calm by default.
                  </div>

                  <ul className="mt-4 space-y-2 text-[14px] leading-[1.7] text-text-secondary">
                    {[
                      "What happened and what we did",
                      "Key timestamps and actions",
                      "Next steps in plain language",
                    ].map((t) => (
                      <li key={t} className="flex gap-3">
                        <span className="mt-2.5 h-1 w-1 rounded-full bg-accent" />
                        {t}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 rounded-xl border border-outline bg-bg-soft p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] text-text-muted">
                        Share link
                      </div>
                      <button
                        className="rounded-md border border-outline bg-transparent px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary transition"
                        type="button"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="mt-2 font-mono text-[12px] text-text-secondary">
                      /publish → /p/Ab3k91QxZp
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </Container>

      <div className="py-10">
        <Container>
          <Rule />
        </Container>
      </div>

      {/* VALUE */}
      <Section
        eyebrow="Why Readable"
        title="Markdown, but easier to consume."
        subtitle="Readable is for the moment your text leaves your editor — when someone else has to understand it quickly."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {reasons.map((r) => (
            <Card key={r.title} title={r.title} desc={r.desc} />
          ))}
        </div>
      </Section>

      <div className="py-2">
        <Container>
          <Rule />
        </Container>
      </div>

      {/* HOW */}
      <Section
        id="how"
        eyebrow="How it works"
        title="Paste → preview → publish → share"
        subtitle="A tiny workflow that matches how you already work."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((f) => (
            <Card key={f.title} title={f.title} desc={f.desc} />
          ))}
        </div>
      </Section>

      <div className="py-2">
        <Container>
          <Rule />
        </Container>
      </div>

      {/* USE CASES */}
      <Section
        id="use-cases"
        eyebrow="Use cases"
        title="For updates, explanations, and handoffs"
        subtitle="If it currently gets pasted into Slack, email, or a ticket… it probably belongs here."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {useCases.map((c) => (
            <Card
              key={c.title}
              title={c.title}
              desc={c.desc}
              footer={c.footer}
            />
          ))}
        </div>
      </Section>

      <div className="py-2">
        <Container>
          <Rule />
        </Container>
      </div>

      {/* INTENTIONAL SIMPLICITY */}
      <Section
        eyebrow="Designed to be simple"
        title="Readable is intentionally not a doc platform."
        subtitle="No accounts, no collaboration, no endless settings. Just clean reading pages you can share."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card
            title="No signup"
            desc="Try it in seconds. If it helps, keep using it. If not, no baggage."
          />
          <Card
            title="Read-only pages"
            desc="Published pages are for reading and sharing — not for managing a workspace."
          />
          <Card
            title="Small surface area"
            desc="Fewer knobs, fewer surprises. The content stays the main character."
          />
        </div>
      </Section>

      <div className="py-2">
        <Container>
          <Rule />
        </Container>
      </div>

      {/* FAQ */}
      <Section
        eyebrow="FAQ"
        title="Quick answers"
        subtitle="Clear, practical, and to the point."
      >
        <div className="rounded-2xl border border-outline bg-bg-soft p-2 shadow-glass">
          <Accordion multiple={false} activeIndex={0}>
            <AccordionTab header="Do I need an account?">
              <div className="text-[14px] leading-[1.7] text-text-secondary">
                No. You can use {APP_NAME} immediately.
              </div>
            </AccordionTab>
            <AccordionTab header="Are published pages public?">
              <div className="text-[14px] leading-[1.7] text-text-secondary">
                Yes — they’re shareable by link. If you publish it, assume it
                can be forwarded.
              </div>
            </AccordionTab>
            <AccordionTab header="Can I edit after publishing?">
              <div className="text-[14px] leading-[1.7] text-text-secondary">
                Not right now. The goal is a simple “publish a clean reading
                link” flow.
              </div>
            </AccordionTab>
            <AccordionTab header="Can I export to PDF or Doc?">
              <div className="text-[14px] leading-[1.7] text-text-secondary">
                Not yet. Sharing a link is the primary experience.
              </div>
            </AccordionTab>
          </Accordion>
        </div>
      </Section>

      {/* FINAL CTA */}
      <div className="border-t border-outline">
        <Container>
          <div className="py-14">
            <div className="rounded-2xl border border-outline bg-bg-soft p-8 shadow-glass">
              <div className="mx-auto max-w-2xl text-center">
                <div className="text-balance text-[24px] sm:text-[28px] font-semibold tracking-tight">
                  Paste once. Share a page people actually read.
                </div>
                <div className="mt-3 text-[15px] leading-[1.7] text-text-secondary">
                  Paste your Markdown, preview instantly, publish a clean
                  reading link.
                </div>
                <div className="mt-7 flex justify-center">
                  <Link href={ROUTES.app}>
                    <Button
                      label="Try it now"
                      rounded
                      className="min-w-fit uppercase tracking-wide"
                    />
                  </Link>
                </div>
                <div className="mt-4 text-[12px] text-text-muted">
                  {APP_NAME} is a sharing tool — not a document warehouse.
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-text-muted">
              <div>
                © {new Date().getFullYear()} {APP_NAME}. Built for clarity.
              </div>
              <div className="flex items-center gap-3">
                <Link
                  className="hover:text-text-primary transition"
                  href={ROUTES.app}
                >
                  Editor
                </Link>
                <a className="hover:text-text-primary transition" href="#how">
                  How it works
                </a>
              </div>
            </div>
          </div>
        </Container>
      </div>

      {/* Component-scoped PrimeReact polish */}
      <style jsx>{`
        :global(.p-button) {
          border-radius: 999px;
          padding: 0.62rem 1rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          box-shadow: none;
        }

        :global(.p-button.p-component) {
          background: var(--p-primary-color);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--p-primary-contrast-color);
        }

        :global(.p-button.p-component:hover) {
          filter: brightness(1.03);
        }

        :global(.p-button.p-button-outlined) {
          background: transparent !important;
          border: 1px solid var(--color-outline) !important;
          color: var(--p-text-color) !important;
        }

        :global(.p-accordion .p-accordion-header-link) {
          background: transparent;
          border: 0;
          box-shadow: none;
          color: var(--p-text-color);
          padding: 0.9rem 0.85rem;
          border-radius: 14px;
        }

        :global(.p-accordion .p-accordion-content) {
          background: transparent;
          border: 0;
          color: var(--p-text-muted-color);
          padding: 0 0.85rem 0.95rem 0.85rem;
        }

        :global(.p-accordion .p-accordion-tab) {
          border-radius: 16px;
          border: 1px solid var(--color-outline);
          margin: 0.5rem;
          overflow: hidden;
          background: var(--p-surface-card);
        }

        @media (prefers-reduced-motion: reduce) {
          :global(*),
          :global(*::before),
          :global(*::after) {
            scroll-behavior: auto !important;
            transition-duration: 0.001ms !important;
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
