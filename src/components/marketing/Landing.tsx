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
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
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
  return <div className="h-px w-full bg-[rgba(255,255,255,0.06)]" />;
}

function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className,
  narrow = false,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <section id={id} className={cn("py-16 sm:py-24", className)}>
      <div className="mx-auto max-w-[70vw] px-4">
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-120px" }}
        >
          <motion.div
            variants={reduce ? undefined : fadeUp}
            className={cn("mx-auto", narrow ? "max-w-180" : "max-w-230")}
          >
            {eyebrow ? (
              <div className="text-[11px] tracking-[0.28em] text-[rgb(var(--rl-muted))]">
                {eyebrow.toUpperCase()}
              </div>
            ) : null}

            <h2 className="mt-4 text-balance text-[28px] leading-[1.2] sm:text-[34px] font-semibold tracking-tight text-[rgb(var(--rl-text))]">
              {title}
            </h2>

            {subtitle ? (
              <p className="mt-4 text-pretty text-[15px] sm:text-[16px] leading-[1.7] text-[rgb(var(--rl-subtext))]">
                {subtitle}
              </p>
            ) : null}
          </motion.div>

          <div className={cn("mt-10", narrow ? "mx-auto max-w-180" : "")}>
            {children}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SubtleCard({
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
        "rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgb(var(--rl-surfaceSubtle))] p-5",
        className,
      )}
    >
      <div className="text-[15px] font-semibold tracking-tight text-[rgb(var(--rl-text))]">
        {title}
      </div>
      <div className="mt-2 text-[14px] leading-[1.7] text-[rgb(var(--rl-subtext))]">
        {desc}
      </div>
    </div>
  );
}

function Quote({ text, who }: { text: string; who: string }) {
  return (
    <div className="py-6">
      <div className="text-[15px] leading-[1.7] text-[rgb(var(--rl-text))]">
        “{text}”
      </div>
      <div className="mt-3 text-[11px] tracking-[0.22em] text-[rgb(var(--rl-muted))]">
        {who.toUpperCase()}
      </div>
    </div>
  );
}

export function Landing() {
  const reduce = useReducedMotion();

  const features = useMemo(
    () => [
      "Smart formatting for headings, lists, tables, and code",
      "Mobile-first layouts that actually read well",
      "Clean spacing and calm typography",
      "Only essential controls: width, spacing, code behavior",
      "Instant preview as you paste",
      "One-click publish and link copy",
    ],
    [],
  );

  return (
    <div className="readable-landing relative bg-[rgb(var(--rl-bg))] text-[rgb(var(--rl-text))]">
      {/* Top bar */}
      <div className="sticky top-0 z-30 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(14,17,22,0.82)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[70vw] items-center justify-between px-4 py-3">
          <div className="leading-tight uppercase">
            <Link href={ROUTES.home}>
              <div className="font-semibold tracking-wide">{APP_NAME}</div>
            </Link>
            <div className="hidden sm:inline-flex text-xs text-[rgb(var(--muted))] tracking-widest">
              Paste. Preview. Share.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="hidden sm:inline-flex rounded-lg border border-[rgba(255,255,255,0.06)] bg-transparent px-3 py-2 text-[12px] text-[rgb(var(--rl-subtext))] hover:text-[rgb(var(--rl-text))] transition"
              onClick={() => {
                const el = document.getElementById("how-it-works");
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              How it works
            </button>

            <Link href={ROUTES.app}>
              <Button label="Try the app" rounded className="min-w-fit" />
            </Link>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className="mx-auto max-w-[70vw] px-4 py-16 sm:py-24">
        <div className="text-center flex justify-center">
          <motion.div variants={container} initial="hidden" animate="show">
            <motion.div variants={reduce ? undefined : fadeUp}>
              <div className="text-[11px] tracking-[0.28em] text-[rgb(var(--rl-muted))]">
                CALM, READABLE SHARING
              </div>

              <h1 className="mt-2 text-balance text-[38px] leading-[1.15] sm:text-[46px] font-bold tracking-tight text-[rgb(var(--rl-text))]">
                Turn any Markdown into a clean page anyone can read
              </h1>

              <p className="mt-3 text-pretty text-[15px] sm:text-[16px] leading-[1.7] text-[rgb(var(--rl-subtext))]">
                {APP_NAME} formats your content instantly, then gives you a
                public link that looks professional on every device. No
                fiddling. No “document formatting” work.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 mx-auto min-w-fit">
                <Link href={ROUTES.app}>
                  <Button label="Try the app" rounded />
                </Link>
                <Button
                  label="See how it works"
                  severity="secondary"
                  outlined
                  onClick={() => {
                    const el = document.getElementById("how-it-works");
                    el?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }}
                />
              </div>

              <div className="mt-10 hidden lg:block">
                <Rule />
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* HERO PREVIEW */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mx-auto max-w-260 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgb(var(--rl-surface))] p-4 sm:p-5">
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Left: raw */}
            <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgb(var(--rl-surfaceSubtle))]">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-[12px] font-semibold text-[rgb(var(--rl-text))]">
                  Pasted content
                </div>
                <div className="text-[11px] text-[rgb(var(--rl-muted))]">
                  monospace
                </div>
              </div>
              <div className="h-px bg-[rgba(255,255,255,0.06)]" />
              <div className="max-h-80 overflow-auto p-4 font-mono text-[12px] leading-[1.65] text-[rgba(230,232,238,0.78)]">
                <pre className="whitespace-pre-wrap">
                  {`## Incident Summary

Root cause analysis below:

- Service A timed out
- Retry logic failed
- Database pool exhausted

\`\`\`js
async function retry() {
  // ...
}
\`\`\``}
                </pre>
              </div>
            </div>

            {/* Right: rendered */}
            <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgb(var(--rl-bg))]">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="text-[12px] font-semibold text-[rgb(var(--rl-text))]">
                  Readable page
                </div>
                <div className="text-[11px] text-[rgb(var(--rl-muted))]">
                  typography-first
                </div>
              </div>
              <div className="h-px bg-[rgba(255,255,255,0.06)]" />
              <div className="p-4">
                <div className="text-[18px] font-semibold tracking-tight text-[rgb(var(--rl-text))]">
                  Incident Summary
                </div>
                <div className="mt-2 text-[14px] leading-[1.7] text-[rgb(var(--rl-subtext))]">
                  Clear enough to forward. Calm enough to trust.
                </div>

                <ul className="mt-4 space-y-2 text-[14px] leading-[1.7] text-[rgb(var(--rl-subtext))]">
                  <li className="flex gap-3">
                    <span className="mt-2.25 h-1 w-1 rounded-full bg-[rgba(255,255,255,0.22)]" />
                    What happened and what we did
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-2.25 h-1 w-1 rounded-full bg-[rgba(255,255,255,0.22)]" />
                    Key timestamps and actions
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-2.25 h-1 w-1 rounded-full bg-[rgba(255,255,255,0.22)]" />
                    Next steps in plain language
                  </li>
                </ul>

                <div className="mt-4 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgb(var(--rl-surface))] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] text-[rgb(var(--rl-muted))]">
                      Code
                    </div>
                    <button
                      className="rounded-md border border-[rgba(255,255,255,0.06)] bg-transparent px-2 py-1 text-[11px] text-[rgb(var(--rl-subtext))] hover:text-[rgb(var(--rl-text))] transition"
                      type="button"
                    >
                      View code
                    </button>
                  </div>
                  <div className="mt-2 font-mono text-[12px] text-[rgba(230,232,238,0.78)]">
                    POST /publish → /p/Ab3k91QxZp
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* WHY THIS EXISTS */}
      <Section
        eyebrow="Why this exists"
        title="People don’t need more editing tools. They need clarity."
        subtitle="Technical text loses meaning the moment it’s forwarded. Spacing breaks. Context disappears. Suddenly you’re apologizing for the format instead of the message."
        narrow
      >
        <div className="text-[15px] leading-[1.75] text-[rgb(var(--rl-subtext))]">
          <p>
            Logs, incident notes, proposals, and troubleshooting steps often end
            up pasted into the wrong places. Non-technical stakeholders miss the
            point, and the message loses impact.
          </p>
          <p>
            {APP_NAME} lets you paste once, preview instantly, and publish
            something that reads on purpose — not by accident.
          </p>
        </div>
      </Section>

      <div className="mx-auto max-w-[70vw] px-4">
        <Rule />
      </div>

      {/* WHAT YOU GET */}
      <Section
        eyebrow="What you get"
        title="Simple by design. Polished by default."
        subtitle="Everything here is engineered to reduce friction — and increase trust in what you share."
        narrow
      >
        <div className="space-y-4">
          {features.map((f) => (
            <div
              key={f}
              className="flex items-start gap-3 text-[15px] leading-[1.75] text-[rgb(var(--rl-subtext))]"
            >
              <span className="mt-2.75 h-1 w-1 flex-none rounded-full bg-[rgb(var(--rl-accent))]" />
              <div>{f}</div>
            </div>
          ))}
        </div>
      </Section>

      <div className="mx-auto max-w-[70vw] px-4">
        <Rule />
      </div>

      {/* HOW IT WORKS */}
      <Section
        id="how-it-works"
        eyebrow="How it works"
        title="Paste → preview → publish → share."
        subtitle="A workflow that matches how you already work — just cleaner at the end."
        narrow
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SubtleCard
            title="1. Paste"
            desc="Drop in the text you already have."
          />
          <SubtleCard
            title="2. Preview"
            desc="Formatting is detected automatically."
          />
          <SubtleCard
            title="3. Publish"
            desc="Your page is generated and stored."
          />
          <SubtleCard
            title="4. Share"
            desc="Send a link that looks good everywhere."
          />
        </div>
      </Section>

      <div className="mx-auto max-w-[70vw] px-4">
        <Rule />
      </div>

      {/* USE CASES */}
      <Section
        eyebrow="Use cases"
        title="Great for updates, explanations, and handoffs."
        subtitle="If it’s currently a paste into Slack or a doc… it belongs here."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SubtleCard
            title="Incident summaries"
            desc="Clear timelines. Calm explanations. No formatting chaos."
          />
          <SubtleCard
            title="Technical proposals"
            desc="Structured thinking that reads well for non-technical reviewers."
          />
          <SubtleCard
            title="Support escalations"
            desc="Context preserved. Easy to forward."
          />
          <SubtleCard
            title="Async explanations"
            desc="Thoughtful writing, without presentation anxiety."
          />
        </div>
      </Section>

      <div className="mx-auto max-w-[70vw] px-4">
        <Rule />
      </div>

      {/* SOCIAL PROOF */}
      <Section
        eyebrow="Social proof"
        title="Built for people who care about clarity."
        subtitle="The win is simple: fewer rewrites, fewer misunderstandings, cleaner forwardable updates."
        narrow
      >
        <div className="divide-y divide-[rgba(255,255,255,0.06)]">
          <Quote
            text="Finally, something I can forward without rewriting."
            who="Program Manager"
          />
          <Quote
            text="The page looks like we meant to send it."
            who="Engineering Lead"
          />
          <Quote
            text="Tables and code that don’t break on mobile."
            who="Support Lead"
          />
        </div>
      </Section>

      <div className="mx-auto max-w-[70vw] px-4">
        <Rule />
      </div>

      {/* PRICING PHILOSOPHY */}
      <Section
        eyebrow="Pricing"
        title="Freemium that stays simple."
        subtitle="This is about trust. Start with clarity; add power later."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgb(var(--rl-surface))] p-6">
            <div className="text-[15px] font-semibold text-[rgb(var(--rl-text))]">
              Free
            </div>
            <ul className="mt-4 space-y-2 text-[14px] leading-[1.7] text-[rgb(var(--rl-subtext))]">
              <li className="flex gap-3">
                <span className="mt-2.25 h-1 w-1 rounded-full bg-[rgba(255,255,255,0.22)]" />
                Public share pages
              </li>
              <li className="flex gap-3">
                <span className="mt-2.25 h-1 w-1 rounded-full bg-[rgba(255,255,255,0.22)]" />
                Clean, readable formatting
              </li>
              <li className="flex gap-3">
                <span className="mt-2.25 h-1 w-1 rounded-full bg-[rgba(255,255,255,0.22)]" />
                No pressure
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgb(var(--rl-surface))] p-6">
            <div className="text-[15px] font-semibold text-[rgb(var(--rl-text))]">
              Pro (later)
            </div>
            <ul className="mt-4 space-y-2 text-[14px] leading-[1.7] text-[rgb(var(--rl-subtext))]">
              <li className="flex gap-3">
                <span className="mt-2.25 h-1 w-1 rounded-full bg-[rgba(255,255,255,0.22)]" />
                Private links
              </li>
              <li className="flex gap-3">
                <span className="mt-2.25 h-1 w-1 rounded-full bg-[rgba(255,255,255,0.22)]" />
                Exports
              </li>
              <li className="flex gap-3">
                <span className="mt-2.25 h-1 w-1 rounded-full bg-[rgba(255,255,255,0.22)]" />
                Branding removal
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <div className="mx-auto max-w-[70vw] px-4">
        <Rule />
      </div>

      {/* FAQ */}
      <Section eyebrow="FAQ" title="Quick answers" narrow>
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgb(var(--rl-surface))] p-2">
          <Accordion multiple={false} activeIndex={0}>
            <AccordionTab header="Do I need an account?">
              <div className="text-[14px] leading-[1.7] text-[rgb(var(--rl-subtext))]">
                No. You can try it immediately. Accounts can come later for
                saving and managing pages.
              </div>
            </AccordionTab>
            <AccordionTab header="Is the share page public?">
              <div className="text-[14px] leading-[1.7] text-[rgb(var(--rl-subtext))]">
                Yes — by default. Private links are coming later.
              </div>
            </AccordionTab>
            <AccordionTab header="Can I export to PDF or Doc?">
              <div className="text-[14px] leading-[1.7] text-[rgb(var(--rl-subtext))]">
                Not yet. Sharing a link is the primary experience.
              </div>
            </AccordionTab>
          </Accordion>
        </div>
      </Section>

      {/* FINAL CTA */}
      <div className="border-t border-[rgba(255,255,255,0.06)]">
        <div className="mx-auto max-w-[70vw] px-4 py-16">
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgb(var(--rl-surface))] p-8">
            <div className="mx-auto max-w-180 text-center">
              <div className="text-balance text-[24px] sm:text-[28px] font-semibold tracking-tight text-[rgb(var(--rl-text))]">
                Make your next update instantly share-ready.
              </div>
              <div className="mt-3 text-[15px] leading-[1.7] text-[rgb(var(--rl-subtext))]">
                Paste content. Preview it. Publish a clean page. Send a link.
              </div>
              <div className="mt-7 flex justify-center">
                <Link href={ROUTES.app}>
                  <Button label="Try the app" rounded />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-4 text-[12px] text-[rgb(var(--rl-muted))]">
            © {new Date().getFullYear()} {APP_NAME}. Built for clarity.
          </div>
        </div>
      </div>

      {/* Scoped styles */}
      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap");

        .readable-landing {
          --rl-bg: 14 17 22; /* #0E1116 */
          --rl-surface: 20 25 35; /* #141923 */
          --rl-surfaceSubtle: 24 30 43; /* #181E2B */
          --rl-text: 230 232 238; /* #E6E8EE */
          --rl-subtext: 167 173 189; /* #A7ADBD */
          --rl-muted: 124 131 152; /* #7C8398 */
          --rl-accent: 122 162 255; /* #7AA2FF */

          font-family:
            "Open Sans",
            ui-sans-serif,
            system-ui,
            -apple-system,
            Segoe UI,
            Roboto,
            Helvetica,
            Arial,
            "Apple Color Emoji",
            "Segoe UI Emoji";
          font-size: 16px;
        }

        /* PrimeReact styling scoped to this component */
        :global(.readable-landing .p-button) {
          border-radius: 10px;
          padding: 0.62rem 0.95rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          box-shadow: none;
        }

        :global(.readable-landing .p-button.p-component) {
          background: rgb(var(--rl-accent));
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: rgb(14, 17, 22);
        }

        :global(.readable-landing .p-button.p-component:hover) {
          filter: brightness(1.02);
        }

        :global(.readable-landing .p-button.p-button-outlined) {
          background: transparent !important;
          border: 1px solid rgba(255, 255, 255, 0.12) !important;
          color: rgb(var(--rl-text)) !important;
        }

        :global(.readable-landing .p-button.p-button-outlined:hover) {
          border-color: rgba(255, 255, 255, 0.18) !important;
        }

        :global(.readable-landing .p-accordion .p-accordion-header-link) {
          background: transparent;
          border: 0;
          box-shadow: none;
          color: rgb(var(--rl-text));
          padding: 0.9rem 0.85rem;
          border-radius: 10px;
        }

        :global(.readable-landing .p-accordion .p-accordion-content) {
          background: transparent;
          border: 0;
          color: rgb(var(--rl-subtext));
          padding: 0 0.85rem 0.95rem 0.85rem;
        }

        :global(.readable-landing .p-accordion .p-accordion-tab) {
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          margin: 0.5rem;
          overflow: hidden;
          background: rgb(var(--rl-surfaceSubtle));
        }

        /* Respect reduced motion (extra safe, beyond framer setting) */
        @media (prefers-reduced-motion: reduce) {
          :global(.readable-landing *),
          :global(.readable-landing *::before),
          :global(.readable-landing *::after) {
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
