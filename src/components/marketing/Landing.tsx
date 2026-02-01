"use client";

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
  className,
}: {
  title: string;
  desc: string;
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
      <div className="mt-2 text-[14px] leading-[1.7] text-text-secondary">
        {desc}
      </div>
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

  const features = useMemo(
    () => [
      {
        title: "Paste anything",
        desc: "Markdown, incident notes, proposal drafts, or raw logs. The messy stuff.",
      },
      {
        title: "Preview instantly",
        desc: "A typography-first page that holds structure (headings, tables, code) without fuss.",
      },
      {
        title: "Publish a link",
        desc: "Share a clean page that reads well on phones, tablets, and desktops.",
      },
      {
        title: "Stay in control",
        desc: "Adjust width, spacing, and code behavior — without turning this into a design tool.",
      },
    ],
    [],
  );

  return (
    <div className="relative min-h-screen bg-bg text-text-primary">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-outline bg-bg-glass/85 backdrop-blur">
        <Container>
          <div className="flex items-center justify-between py-3">
            <div className="leading-tight">
              <Link
                href={ROUTES.home}
                className="inline-flex items-baseline gap-2"
              >
                <div className="font-semibold tracking-wide uppercase">
                  {APP_NAME}
                </div>
                <div className="hidden sm:inline text-xs text-text-muted tracking-widest uppercase">
                  Paste. Preview. Share.
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <a
                className="hidden md:inline text-xs text-text-muted hover:text-text-primary transition"
                href="#how"
              >
                How it works
              </a>
              <a
                className="hidden md:inline text-xs text-text-muted hover:text-text-primary transition"
                href="#use-cases"
              >
                Use cases
              </a>
              <Link href={ROUTES.app}>
                <Button
                  label="Open editor"
                  rounded
                  className="min-w-fit uppercase tracking-wide"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                />
              </Link>
            </div>
          </div>
        </Container>
      </div>

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
                <Badge>Typography-first</Badge>
                <Badge>Mobile-readable</Badge>
                <Badge>Share with a link</Badge>
              </div>

              <h1 className="mt-5 text-balance text-[38px] leading-[1.12] sm:text-[48px] font-bold tracking-tight">
                Your updates shouldn’t lose meaning when you hit “paste”.
              </h1>

              <p className="mt-4 max-w-2xl text-pretty text-[15px] sm:text-[16px] leading-[1.7] text-text-secondary">
                {APP_NAME} turns technical text into calm, readable pages — then
                gives you a share link that looks professional on every device.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href={ROUTES.app}>
                  <Button
                    label="Open editor"
                    rounded
                    className="min-w-fit uppercase tracking-wide"
                  />
                </Link>
                <Button
                  label="See the flow"
                  className="min-w-fit uppercase tracking-wide"
                  severity="secondary"
                  outlined
                  onClick={() => {
                    const el = document.getElementById("how");
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
                    Pasted content
                  </div>
                  <div className="text-[11px] text-text-muted">monospace</div>
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
                  <div className="text-[11px] text-text-muted">
                    typography-first
                  </div>
                </div>
                <div className="h-px bg-outline" />
                <div className="p-4">
                  <div className="text-[18px] font-semibold tracking-tight">
                    Incident Summary
                  </div>
                  <div className="mt-2 text-[14px] leading-[1.7] text-text-secondary">
                    Clear enough to forward. Calm enough to trust.
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
                      <div className="text-[12px] text-text-muted">Code</div>
                      <button
                        className="rounded-md border border-outline bg-transparent px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary transition"
                        type="button"
                      >
                        View code
                      </button>
                    </div>
                    <div className="mt-2 font-mono text-[12px] text-text-secondary">
                      POST /publish → /p/Ab3k91QxZp
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
        title="Clarity is a product feature. So is presentation."
        subtitle="The moment your text gets forwarded, formatting becomes part of the message. Readable keeps structure, spacing, and code intact — without turning you into a designer."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card
            title="Made for the non-technical reader"
            desc="Your update can be understood without the context of Slack threads, docs, or tools."
          />
          <Card
            title="A page that looks intentional"
            desc="Instead of apologizing for messy formatting, send a link that feels finished."
          />
          <Card
            title="Mobile-first by default"
            desc="Tables, lists, and code blocks are laid out to read well on phones."
          />
          <Card
            title="Fast workflow"
            desc="Paste, adjust a couple of knobs, publish. Your brain stays on the content."
          />
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
        subtitle="A tiny workflow that matches how you already work — the output is just calmer."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
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
        title="Great for updates, explanations, and handoffs"
        subtitle="If it’s currently a paste into Slack, email, or a doc… it probably belongs here."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card
            title="Incident summaries"
            desc="Clear timelines. Calm explanations. No formatting chaos."
          />
          <Card
            title="Technical proposals"
            desc="Structured thinking that reads well for non-technical reviewers."
          />
          <Card
            title="Support escalations"
            desc="Context preserved. Easy to forward. Less back-and-forth."
          />
          <Card
            title="Async explanations"
            desc="Thoughtful writing, without presentation anxiety."
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
        subtitle="The basics, without the marketing fog."
      >
        <div className="rounded-2xl border border-outline bg-bg-soft p-2 shadow-glass">
          <Accordion multiple={false} activeIndex={0}>
            <AccordionTab header="Do I need an account?">
              <div className="text-[14px] leading-[1.7] text-text-secondary">
                No. You can try it immediately. Accounts can come later for
                saving and managing pages.
              </div>
            </AccordionTab>
            <AccordionTab header="Is the share page public?">
              <div className="text-[14px] leading-[1.7] text-text-secondary">
                Yes — by default. Private links are a sensible next step.
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
                  Make your next update instantly share-ready.
                </div>
                <div className="mt-3 text-[15px] leading-[1.7] text-text-secondary">
                  Paste content. Preview it. Publish a clean page. Send a link.
                </div>
                <div className="mt-7 flex justify-center">
                  <Link href={ROUTES.app}>
                    <Button
                      label="Open editor"
                      rounded
                      className="min-w-fit uppercase tracking-wide"
                    />
                  </Link>
                </div>
                <div className="mt-4 text-[12px] text-text-muted">
                  Pages expire automatically after a while. This is a sharing
                  tool — not a document warehouse.
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
