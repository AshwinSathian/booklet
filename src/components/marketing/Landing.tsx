"use client";

import { AppLogo } from "@/components/ui/AppLogo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { trackEvent } from "@/lib/analytics";
import { APP_NAME, ROUTES } from "@/lib/constants";
import type { Easing, Variants } from "framer-motion";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import React, { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const ease: Easing = [0.16, 1, 0.3, 1];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease },
  },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

// ---------------------------------------------------------------------------
// Primitive layout
// ---------------------------------------------------------------------------

function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-6", className)}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-outline" />;
}

// ---------------------------------------------------------------------------
// Buttons (custom — no PrimeReact)
// ---------------------------------------------------------------------------

function PrimaryButton({
  href,
  onClick,
  children,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const cls =
    "inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

function GhostButton({
  href,
  onClick,
  children,
  external,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  external?: boolean;
}) {
  const cls =
    "inline-flex items-center gap-2 rounded-full border border-outline bg-transparent px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

  if (external && href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick}>
        {children}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  id,
  eyebrow,
  title,
  subtitle,
  children,
  className,
  center,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  center?: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <section id={id} className={cn("py-16 sm:py-24", className)}>
      <Container>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          <motion.div variants={reduce ? undefined : fadeUp} className={center ? "text-center" : ""}>
            {eyebrow ? (
              <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-accent">
                {eyebrow}
              </div>
            ) : null}
            <h2 className={cn(
              "mt-3 text-balance text-[26px] leading-[1.18] sm:text-[32px] font-bold tracking-[-0.02em]",
              center ? "mx-auto max-w-2xl" : "max-w-3xl",
            )}>
              {title}
            </h2>
            {subtitle ? (
              <p className={cn(
                "mt-4 text-pretty text-[15px] leading-[1.72] text-text-secondary",
                center ? "mx-auto max-w-xl" : "max-w-2xl",
              )}>
                {subtitle}
              </p>
            ) : null}
          </motion.div>

          <motion.div variants={reduce ? undefined : fadeUp} className="mt-10">
            {children}
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function ValueCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-outline bg-bg-elevated p-5 shadow-card transition hover:border-outline/60">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-lg">
        {icon}
      </div>
      <div className="text-[14px] font-semibold tracking-tight">{title}</div>
      <div className="text-[13px] leading-[1.72] text-text-secondary">{desc}</div>
    </div>
  );
}

function ExampleCard({
  title,
  desc,
  href,
  tag,
}: {
  title: string;
  desc: string;
  href: string;
  tag: string;
}) {
  return (
    <div className="group flex flex-col gap-4 rounded-2xl border border-outline bg-bg-elevated p-5 shadow-card transition hover:border-accent-soft/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-widest uppercase text-accent">
            {tag}
          </div>
          <div className="mt-2 text-[14px] font-semibold tracking-tight">{title}</div>
        </div>
      </div>
      <div className="text-[13px] leading-[1.72] text-text-secondary">{desc}</div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent transition hover:text-accent-soft"
        onClick={() => trackEvent("example_clicked", { example: tag })}
      >
        View example
        <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
          <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ (native details/summary, no PrimeReact)
// ---------------------------------------------------------------------------

function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn(
      "border-b border-outline last:border-0 transition",
    )}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 py-4 text-left text-[14px] font-semibold tracking-tight transition hover:text-accent focus-visible:outline-none"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{question}</span>
        <span className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-outline text-text-muted transition",
          open && "rotate-180",
        )}>
          <svg width="10" height="10" fill="none" viewBox="0 0 10 10" aria-hidden>
            <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open ? (
        <div className="pb-4 text-[13px] leading-[1.75] text-text-secondary">
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero product mock
// ---------------------------------------------------------------------------

function HeroMock() {
  return (
    <div className="rounded-2xl border border-outline bg-bg-elevated shadow-glass overflow-hidden">
      {/* Mock topbar */}
      <div className="flex items-center gap-2 border-b border-outline px-4 py-3 bg-bg-soft">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="rounded-md bg-bg-glass px-8 py-0.5 text-[11px] text-text-muted">
            readable.app
          </div>
        </div>
        <div className="rounded-full bg-accent px-3 py-1 text-[10px] font-semibold text-white">
          Publish
        </div>
      </div>

      {/* Mock editor/preview split */}
      <div className="grid grid-cols-2 divide-x divide-outline">
        {/* Editor */}
        <div className="p-4">
          <div className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-text-muted">
            Editor
          </div>
          <pre className="font-mono text-[11px] leading-[1.65] text-text-secondary whitespace-pre-wrap overflow-hidden">
{`## Incident Summary

**Impact:** API degraded
**Duration:** 22 min

### Root cause

Database connection pool
exhausted after deploy.

- Pool size misconfigured
- Health check delayed
- Alert threshold too high

\`\`\`bash
max_connections=5 # was 50
\`\`\``}
          </pre>
        </div>

        {/* Preview */}
        <div className="p-4 bg-bg">
          <div className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-text-muted">
            Preview
          </div>
          <div className="text-[13px] font-semibold tracking-tight">Incident Summary</div>
          <div className="mt-1.5 text-[11px] leading-[1.7] text-text-secondary">
            <span className="font-semibold text-text-primary">Impact:</span> API degraded
          </div>
          <div className="text-[11px] leading-[1.7] text-text-secondary">
            <span className="font-semibold text-text-primary">Duration:</span> 22 min
          </div>
          <div className="mt-2.5 text-[11px] font-semibold">Root cause</div>
          <div className="mt-1 text-[11px] leading-[1.7] text-text-secondary">
            Database connection pool exhausted after deploy.
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {["Pool size misconfigured", "Health check delayed", "Alert threshold too high"].map((t) => (
              <li key={t} className="flex items-start gap-1.5 text-[10px] text-text-secondary">
                <span className="mt-1.25 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-2.5 rounded-lg bg-bg-soft border border-outline p-2 font-mono text-[10px] text-text-muted">
            max_connections=5
          </div>
        </div>
      </div>

      {/* Publish bar */}
      <div className="flex items-center gap-2 border-t border-outline px-4 py-2.5 bg-bg-soft">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <div className="flex-1 font-mono text-[10px] text-text-muted truncate">
          readable.app/p/Ab3k91QxZp
        </div>
        <div className="text-[10px] font-semibold text-accent">Copy link</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Landing() {
  const reduce = useReducedMotion();

  const steps = useMemo(
    () => [
      {
        n: "01",
        title: "Paste your Markdown",
        desc: "Drop in notes, READMEs, incident updates, proposals — anything Markdown-shaped.",
      },
      {
        n: "02",
        title: "Preview instantly",
        desc: "Readable keeps headings, lists, tables, and code structured and calm.",
      },
      {
        n: "03",
        title: "Publish a link",
        desc: "One click creates a clean, read-only URL. No account needed.",
      },
      {
        n: "04",
        title: "Share without friction",
        desc: "Send in Slack, email, or a ticket. Your reader just reads.",
      },
    ],
    [],
  );

  const values = useMemo(
    () => [
      {
        icon: "⚡",
        title: "Works in seconds",
        desc: "No signup, no onboarding. Paste and you're in the editor.",
      },
      {
        icon: "🔗",
        title: "A link that feels finished",
        desc: "Typography, spacing, and layout are handled so your content lands the way you meant it.",
      },
      {
        icon: "📤",
        title: "Built for forwarding",
        desc: "When your message gets escalated or copied into a thread, the structure stays intact.",
      },
      {
        icon: "🧘",
        title: "Intentionally simple",
        desc: "No collaboration, no comments, no feeds. Just a clean reading page.",
      },
    ],
    [],
  );

  const useCases = useMemo(
    () => [
      {
        tag: "Incident",
        title: "Incident summaries",
        desc: "Timelines, impact, root cause, next steps — structured enough to forward.",
        href: "https://readable.ashwinsathian.com/p/GqfTrJQg0t",
      },
      {
        tag: "ADR",
        title: "Design notes & decisions",
        desc: "Tradeoffs and decisions that make sense even to someone outside the repo.",
        href: "https://readable.ashwinsathian.com/p/Vmm78unhPg",
      },
      {
        tag: "Docs",
        title: "README-style docs",
        desc: "Documentation you can share without sending someone to GitHub first.",
        href: "https://readable.ashwinsathian.com/p/6MTZfx3M6q",
      },
    ],
    [],
  );

  return (
    <div className="relative min-h-screen bg-bg text-text-primary">

      {/* ------------------------------------------------------------------ */}
      {/* Sticky nav                                                           */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-20 border-b border-outline/70 bg-bg/80 backdrop-blur-xl">
        <Container>
          <div className="flex items-center justify-between py-3.5">
            <AppLogo onlyIcon={false} />
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <PrimaryButton
                href={ROUTES.app}
                onClick={() => trackEvent("open_editor_clicked", { location: "topbar" })}
              >
                Open editor
                <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </PrimaryButton>
            </div>
          </div>
        </Container>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        {/* Background mesh */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-125 w-125 -translate-x-1/2 rounded-full bg-accent opacity-[0.09] blur-[80px]" />
          <div className="absolute top-40 -right-24 h-80 w-80 rounded-full bg-accent-warm opacity-[0.05] blur-[60px]" />
          <div className="absolute bottom-0 -left-20 h-72 w-72 rounded-full bg-accent opacity-[0.06] blur-[60px]" />
        </div>

        <Container>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="relative z-10"
          >
            {/* Eyebrow */}
            <motion.div variants={reduce ? undefined : fadeUp}>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/8 px-3.5 py-1 text-[11px] font-semibold tracking-wide text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                No signup · Free · Expires in 30 days
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={reduce ? undefined : fadeUp}
              className="mt-5 text-balance text-[40px] leading-[1.08] sm:text-[58px] font-bold tracking-[-0.03em] max-w-3xl"
            >
              Your Markdown,{" "}
              <span className="bg-linear-to-r from-accent to-accent-soft bg-clip-text text-transparent">
                beautifully readable.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={reduce ? undefined : fadeUp}
              className="mt-5 max-w-xl text-pretty text-[16px] leading-[1.75] text-text-secondary"
            >
              Paste your Markdown. Get a clean, shareable reading page instantly — without asking
              your reader to open a repo, doc tool, or thread for context.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={reduce ? undefined : fadeUp}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <PrimaryButton
                href={ROUTES.app}
                onClick={() => trackEvent("open_editor_clicked", { location: "hero" })}
              >
                Try it now — it&apos;s free
                <svg width="13" height="13" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </PrimaryButton>
              <GhostButton onClick={() => {
                document.getElementById("how")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}>
                How it works
              </GhostButton>
            </motion.div>

            <motion.div
              variants={reduce ? undefined : fadeUp}
              className="mt-4 text-[12px] text-text-muted"
            >
              Press <kbd className="rounded border border-outline bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px]">⌘</kbd>{" "}
              +{" "}
              <kbd className="rounded border border-outline bg-bg-elevated px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>{" "}
              to publish from the editor
            </motion.div>
          </motion.div>

          {/* Product mock */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease }}
            className="relative mt-14 z-10"
          >
            <HeroMock />
          </motion.div>
        </Container>
      </section>

      <Container>
        <Divider />
      </Container>

      {/* ------------------------------------------------------------------ */}
      {/* How it works                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Section
        id="how"
        eyebrow="How it works"
        title="Paste → preview → publish → share"
        subtitle="A four-step workflow that fits inside your existing process."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <motion.div
              key={s.n}
              variants={reduce ? undefined : fadeUp}
              className="flex flex-col gap-3 rounded-2xl border border-outline bg-bg-elevated p-5 shadow-card"
            >
              <div className="font-mono text-[11px] font-semibold text-accent">{s.n}</div>
              <div className="text-[14px] font-semibold tracking-tight">{s.title}</div>
              <div className="text-[13px] leading-[1.72] text-text-secondary">{s.desc}</div>
            </motion.div>
          ))}
        </div>
      </Section>

      <Container>
        <Divider />
      </Container>

      {/* ------------------------------------------------------------------ */}
      {/* Use cases                                                            */}
      {/* ------------------------------------------------------------------ */}
      <Section
        id="use-cases"
        eyebrow="Use cases"
        title="For updates, explanations, and handoffs"
        subtitle="If it currently gets pasted into Slack, email, or a ticket — it probably belongs here."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {useCases.map((c) => (
            <motion.div key={c.tag} variants={reduce ? undefined : fadeUp}>
              <ExampleCard {...c} />
            </motion.div>
          ))}
        </div>
      </Section>

      <Container>
        <Divider />
      </Container>

      {/* ------------------------------------------------------------------ */}
      {/* Value props                                                          */}
      {/* ------------------------------------------------------------------ */}
      <Section
        eyebrow="Why Readable"
        title="Markdown is great for writing. Not always for reading."
        subtitle={'Readable is the small step between raw Markdown and “please open this tool to understand it.”'}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => (
            <motion.div key={v.title} variants={reduce ? undefined : fadeUp}>
              <ValueCard {...v} />
            </motion.div>
          ))}
        </div>
      </Section>

      <Container>
        <Divider />
      </Container>

      {/* ------------------------------------------------------------------ */}
      {/* FAQ                                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Section
        eyebrow="FAQ"
        title="Quick answers"
        center
      >
        <div className="mx-auto max-w-2xl rounded-2xl border border-outline bg-bg-elevated px-6 shadow-card">
          <FaqItem question="Do I need an account?">
            No. {APP_NAME} works immediately — no signup, no email, no password.
          </FaqItem>
          <FaqItem question="Are published pages public?">
            Yes — they&apos;re accessible by anyone with the link. If you publish it, assume it can
            be forwarded.
          </FaqItem>
          <FaqItem question="How long do pages last?">
            30 days from the time of publishing. The page shows an expiry countdown at the top.
          </FaqItem>
          <FaqItem question="Can I edit after publishing?">
            Not right now. Published snapshots are immutable. You can edit your local draft and
            republish — which creates a new link.
          </FaqItem>
          <FaqItem question="Can I export to PDF?">
            Use your browser&apos;s print function on the published page (File → Print or Ctrl/⌘+P).
            It produces a clean PDF with no chrome.
          </FaqItem>
          <FaqItem question="Where are drafts stored?">
            Entirely in your browser&apos;s localStorage — nothing is sent to the server until you
            publish.
          </FaqItem>
        </div>
      </Section>

      <Container>
        <Divider />
      </Container>

      {/* ------------------------------------------------------------------ */}
      {/* Final CTA                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="py-16 sm:py-24">
        <Container>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="relative overflow-hidden rounded-3xl border border-accent/20 bg-bg-elevated px-8 py-14 text-center shadow-glow"
          >
            {/* Glow */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-20 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-accent opacity-[0.12] blur-3xl" />
            </div>

            <motion.div variants={reduce ? undefined : fadeUp} className="relative z-10">
              <div className="text-[10px] font-semibold tracking-[0.22em] uppercase text-accent">
                Get started
              </div>
              <h2 className="mt-3 text-balance text-[28px] leading-[1.15] sm:text-[36px] font-bold tracking-[-0.02em]">
                Paste once. Share a page people actually read.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-[1.72] text-text-secondary">
                Free. No account. Takes 30 seconds.
              </p>
              <div className="mt-8 flex justify-center">
                <PrimaryButton
                  href={ROUTES.app}
                  onClick={() => trackEvent("open_editor_clicked", { location: "cta" })}
                >
                  Open the editor
                  <svg width="13" height="13" fill="none" viewBox="0 0 12 12" aria-hidden>
                    <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </PrimaryButton>
              </div>
            </motion.div>
          </motion.div>
        </Container>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                               */}
      {/* ------------------------------------------------------------------ */}
      <footer className="border-t border-outline">
        <Container>
          <div className="flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
            <div className="flex items-center gap-3">
              <AppLogo onlyIcon={true} />
              <span className="text-[12px] text-text-muted">
                © {new Date().getFullYear()} {APP_NAME}. Built for clarity.
              </span>
            </div>
            <nav className="flex items-center gap-5 text-[12px] text-text-muted" aria-label="Footer navigation">
              <Link href={ROUTES.app} className="transition hover:text-text-primary">
                Editor
              </Link>
              <button
                type="button"
                className="transition hover:text-text-primary"
                onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
              >
                How it works
              </button>
              <button
                type="button"
                className="transition hover:text-text-primary"
                onClick={() => document.getElementById("use-cases")?.scrollIntoView({ behavior: "smooth" })}
              >
                Examples
              </button>
            </nav>
          </div>
        </Container>
      </footer>
    </div>
  );
}
