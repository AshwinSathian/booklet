"use client";

import { AppLogo } from "@/components/ui/AppLogo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { trackEvent } from "@/lib/analytics";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { UserButton, useUser } from "@clerk/nextjs";
import type { Easing, Variants } from "framer-motion";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import React, { useMemo, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const ease: Easing = [0.16, 1, 0.3, 1];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.65, ease },
  },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Layout primitives
// ─────────────────────────────────────────────────────────────────────────────

function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-border-default" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Buttons
// ─────────────────────────────────────────────────────────────────────────────

function PrimaryButton({
  href,
  onClick,
  children,
  large,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  large?: boolean;
}) {
  const cls = cn(
    "inline-flex items-center gap-2 rounded-full bg-accent font-semibold text-white shadow-soft",
    "transition hover:bg-accent-hover active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    large ? "px-7 py-3.5 text-[15px]" : "px-5 py-2.5 text-sm",
  );

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
    "inline-flex items-center gap-2 rounded-full border border-border-default bg-transparent px-5 py-2.5 text-sm font-semibold text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

  if (external && href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        onClick={onClick}
      >
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

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

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
    <section id={id} className={cn("py-20 sm:py-28", className)}>
      <Container>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          <motion.div
            variants={reduce ? undefined : fadeUp}
            className={center ? "text-center" : ""}
          >
            {eyebrow ? (
              <div className="text-2xs font-semibold tracking-[0.24em] uppercase text-accent">
                {eyebrow}
              </div>
            ) : null}
            <h2
              className={cn(
                "mt-3 text-balance text-[30px] leading-[1.14] font-bold tracking-[-0.03em] sm:text-[40px]",
                center ? "mx-auto max-w-2xl" : "max-w-3xl",
              )}
            >
              {title}
            </h2>
            {subtitle ? (
              <p
                className={cn(
                  "mt-4 text-pretty text-[17px] leading-[1.75] text-text-secondary",
                  center ? "mx-auto max-w-xl" : "max-w-2xl",
                )}
              >
                {subtitle}
              </p>
            ) : null}
          </motion.div>

          <motion.div variants={reduce ? undefined : fadeUp} className="mt-12">
            {children}
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature cards (SVG icons — no emoji)
// ─────────────────────────────────────────────────────────────────────────────

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-dim text-accent">
      {children}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border-default bg-bg-elevated p-6 shadow-card transition hover:border-border-strong hover:bg-bg-soft">
      <FeatureIcon>{icon}</FeatureIcon>
      <div className="text-[15px] font-semibold tracking-tight">{title}</div>
      <div className="text-[15px] leading-[1.72] text-text-secondary">{desc}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Example cards (use cases with links)
// ─────────────────────────────────────────────────────────────────────────────

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
    <div className="group flex flex-col gap-4 rounded-2xl border border-border-default bg-bg-elevated p-6 shadow-card transition hover:border-accent-soft/40 hover:bg-bg-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center rounded-full bg-accent-dim px-2.5 py-0.5 text-2xs font-semibold tracking-widest uppercase text-accent">
            {tag}
          </div>
          <div className="mt-2.5 text-[15px] font-semibold tracking-tight">{title}</div>
        </div>
      </div>
      <div className="text-[15px] leading-[1.72] text-text-secondary">{desc}</div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent transition hover:text-accent-soft"
        onClick={() => trackEvent("example_clicked", { example: tag })}
      >
        View live example
        <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ — native details/summary, no PrimeReact
// ─────────────────────────────────────────────────────────────────────────────

function FaqItem({
  question,
  children,
}: {
  question: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border-default last:border-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 py-5 text-left text-[15px] font-semibold tracking-tight transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{question}</span>
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border-default text-text-muted transition-transform duration-normal ease-spring",
            open && "rotate-180",
          )}
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 10 10" aria-hidden>
            <path
              d="M2 3.5 5 6.5 8 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      <div
        className="grid transition-all duration-normal ease-spring"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="pb-5 text-[15px] leading-[1.78] text-text-secondary">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero product mock — shows the markdown → beautiful page transformation
// ─────────────────────────────────────────────────────────────────────────────

function HeroMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-default bg-bg-elevated shadow-glass">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border-default bg-bg-soft px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex flex-1 justify-center">
          <div className="rounded-md bg-bg-glass px-8 py-1 text-xs text-text-muted font-mono backdrop-blur">
            readable.app
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-2xs font-semibold text-white">
          Publish
          <svg width="9" height="9" fill="none" viewBox="0 0 9 9" aria-hidden>
            <path
              d="M1.5 7.5 7.5 1.5M7.5 1.5H3M7.5 1.5V6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Editor / Preview split */}
      <div className="grid grid-cols-2 divide-x divide-border-default">
        {/* ── Markdown editor */}
        <div className="p-4 sm:p-5">
          <div className="mb-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Markdown
          </div>
          <pre className="overflow-hidden whitespace-pre-wrap font-mono text-[11px] leading-[1.7] text-text-secondary">
{`# Incident Report

**Severity:** P1
**Status:** Resolved

## Timeline

- 14:32 Alert triggered
- 14:45 Root cause found
- 15:01 Fix deployed

## Root Cause

DB pool exhausted after
Tuesday's deploy.

\`\`\`yaml
pool_size: 5 # was 50
\`\`\``}
          </pre>
        </div>

        {/* ── Rendered preview */}
        <div className="bg-bg p-4 sm:p-5">
          <div className="mb-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Preview
          </div>

          <div className="text-[13px] font-bold tracking-tight text-text-primary">
            Incident Report
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[9px] font-semibold text-red-400">
              P1
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
              Resolved
            </span>
          </div>

          <div className="mt-3 text-[11px] font-semibold text-text-primary">
            Timeline
          </div>
          <ul className="mt-1.5 space-y-1">
            {["14:32 — Alert triggered", "14:45 — Root cause found", "15:01 — Fix deployed"].map(
              (t) => (
                <li key={t} className="flex items-start gap-2 text-2xs text-text-secondary">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ),
            )}
          </ul>

          <div className="mt-3 text-[11px] font-semibold text-text-primary">
            Root Cause
          </div>
          <div className="mt-1 text-2xs leading-[1.65] text-text-secondary">
            DB pool exhausted after Tuesday&apos;s deploy.
          </div>

          <div className="mt-2.5 rounded-lg border border-border-default bg-bg-elevated px-3 py-2 font-mono text-2xs text-text-muted">
            <span className="text-accent-soft">pool_size</span>
            {": 5  "}
            <span className="text-text-muted/60"># was 50</span>
          </div>
        </div>
      </div>

      {/* Published URL bar */}
      <div className="flex items-center gap-2.5 border-t border-border-default bg-bg-soft px-4 py-2.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
        <span className="flex-1 truncate font-mono text-2xs text-text-muted">
          readable.app/p/Ab3k91QxZp
        </span>
        <button
          type="button"
          className="shrink-0 text-2xs font-semibold text-accent transition hover:text-accent-soft"
        >
          Copy link
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Landing component
// ─────────────────────────────────────────────────────────────────────────────

export function Landing() {
  const reduce = useReducedMotion();
  const { isSignedIn } = useUser();

  const steps = useMemo(
    () => [
      {
        n: "01",
        title: "Paste your Markdown",
        desc: "Drop in notes, READMEs, incident updates, or proposals — anything Markdown-shaped.",
      },
      {
        n: "02",
        title: "See it rendered instantly",
        desc: "Readable formats headings, code, lists, and tables live as you type.",
      },
      {
        n: "03",
        title: "Publish with one click",
        desc: "Hit publish and get a clean, read-only URL. No account, no configuration.",
      },
      {
        n: "04",
        title: "Share without friction",
        desc: "Send in Slack, email, or a ticket. Your reader just reads.",
      },
    ],
    [],
  );

  const features = useMemo(
    () => [
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
          </svg>
        ),
        title: "Live preview as you type",
        desc: "Your rendered page updates in real time. What you see is exactly what your readers get — no surprises.",
      },
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
        title: "One link. Instantly shareable.",
        desc: "Hit publish and get a clean URL in seconds. Paste it into Slack, email, a PR, or a ticket — it just works.",
      },
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M4 6h16M4 10h16M4 14h10"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
        title: "Beautiful by default",
        desc: "Typography, code blocks, tables, headings — all rendered with care. Zero configuration, zero CSS, zero effort.",
      },
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
            <path
              d="M7 11V7a5 5 0 0 1 10 0v4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
        title: "Private until you publish",
        desc: "Every draft stays in your browser. Nothing leaves your device until you deliberately hit publish.",
      },
    ],
    [],
  );

  const useCases = useMemo(
    () => [
      {
        tag: "Incident",
        title: "Incident summaries",
        desc: "Timelines, impact, root cause, next steps — structured enough to forward to leadership.",
        href: "https://readable.ashwinsathian.com/p/GqfTrJQg0t",
      },
      {
        tag: "ADR",
        title: "Design notes & decisions",
        desc: "Architecture decisions and tradeoffs that make sense even to someone outside the repo.",
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

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Sticky navigation                                                    */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border-default/60 bg-bg/80 backdrop-blur-xl">
        <Container>
          <div className="flex items-center justify-between py-4">
            <AppLogo onlyIcon={false} />
            <nav
              className="hidden items-center gap-6 sm:flex"
              aria-label="Site navigation"
            >
              <a
                href="#features"
                className="text-sm text-text-muted transition hover:text-text-primary"
              >
                Features
              </a>
              <a
                href="#how"
                className="text-sm text-text-muted transition hover:text-text-primary"
              >
                How it works
              </a>
              <a
                href="#examples"
                className="text-sm text-text-muted transition hover:text-text-primary"
              >
                Examples
              </a>
            </nav>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {isSignedIn ? (
                <UserButton />
              ) : (
                <GhostButton href={ROUTES.signIn}>Sign in</GhostButton>
              )}
              <PrimaryButton
                href={ROUTES.app}
                onClick={() => trackEvent("open_editor_clicked", { location: "topbar" })}
              >
                Open editor
                <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path
                    d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </PrimaryButton>
            </div>
          </div>
        </Container>
      </header>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Hero                                                                  */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-32 lg:py-40">
        {/* Background ambient glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-48 left-1/2 h-150 w-150 -translate-x-1/2 rounded-full bg-accent opacity-[0.07] blur-[100px]" />
          <div className="absolute top-1/3 -right-32 h-100 w-100 rounded-full bg-accent-warm opacity-[0.04] blur-[80px]" />
          <div className="absolute bottom-0 -left-24 h-87.5 w-87.5 rounded-full bg-accent opacity-[0.05] blur-[80px]" />
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
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-dim px-4 py-1.5 text-xs font-semibold tracking-wide text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Free · No account · Published in seconds
              </div>
            </motion.div>

            {/* Headline — Apple-scale type */}
            <motion.h1
              variants={reduce ? undefined : fadeUp}
              className="mt-6 max-w-4xl text-balance text-[52px] font-bold leading-[1.02] tracking-[-0.04em] sm:text-[72px] lg:text-[88px]"
            >
              Write in Markdown.{" "}
              <span className="bg-linear-to-r from-accent via-accent-soft to-accent bg-clip-text text-transparent">
                Get a page worth sharing.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={reduce ? undefined : fadeUp}
              className="mt-6 max-w-2xl text-pretty text-[18px] leading-[1.75] text-text-secondary"
            >
              Readable turns your plain text into a beautifully formatted page — with
              proper headings, code blocks, and tables — shareable with a single link.
              No setup, no noise.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={reduce ? undefined : fadeUp}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <PrimaryButton
                href={ROUTES.app}
                large
                onClick={() => trackEvent("open_editor_clicked", { location: "hero" })}
              >
                Open the editor — it&apos;s free
                <svg width="14" height="14" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path
                    d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </PrimaryButton>
              <GhostButton
                onClick={() => {
                  document
                    .getElementById("examples")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                See live examples
              </GhostButton>
            </motion.div>

            {/* Keyboard hint */}
            <motion.div
              variants={reduce ? undefined : fadeUp}
              className="mt-4 text-[13px] text-text-muted"
            >
              Press{" "}
              <kbd className="rounded border border-border-default bg-bg-elevated px-1.5 py-0.5 font-mono text-2xs">
                ⌘
              </kbd>{" "}
              +{" "}
              <kbd className="rounded border border-border-default bg-bg-elevated px-1.5 py-0.5 font-mono text-2xs">
                ↵
              </kbd>{" "}
              to publish from the editor
            </motion.div>
          </motion.div>

          {/* Product mock */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.28, ease }}
            className="relative mt-16 z-10"
          >
            <HeroMock />
          </motion.div>
        </Container>
      </section>

      <Container>
        <Divider />
      </Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Features                                                              */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section
        id="features"
        eyebrow="Features"
        title="Everything your share needs."
        subtitle="Readable handles all the formatting complexity so your content lands exactly the way you meant it — for everyone on the receiving end."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <motion.div key={f.title} variants={reduce ? undefined : fadeUp}>
              <FeatureCard icon={f.icon} title={f.title} desc={f.desc} />
            </motion.div>
          ))}
        </div>
      </Section>

      <Container>
        <Divider />
      </Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* How it works                                                          */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section
        id="how"
        eyebrow="How it works"
        title="Paste → preview → publish → share."
        subtitle="Four steps that fit inside your existing workflow. No new tool to learn — just a cleaner way to forward what you already wrote."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <motion.div
              key={s.n}
              variants={reduce ? undefined : fadeUp}
              className="flex flex-col gap-4 rounded-2xl border border-border-default bg-bg-elevated p-6 shadow-card transition hover:border-border-strong hover:bg-bg-soft"
            >
              <div className="font-mono text-sm font-semibold text-accent">{s.n}</div>
              <div className="text-[15px] font-semibold tracking-tight">{s.title}</div>
              <div className="text-[15px] leading-[1.72] text-text-secondary">{s.desc}</div>
            </motion.div>
          ))}
        </div>
      </Section>

      <Container>
        <Divider />
      </Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Examples / Use cases                                                  */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section
        id="examples"
        eyebrow="Examples"
        title="Real pages, real use cases."
        subtitle="If it gets pasted into Slack, emailed, or dropped into a ticket — it belongs in Readable."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* FAQ                                                                   */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section id="faq" eyebrow="FAQ" title="Quick answers." center>
        <div className="mx-auto max-w-2xl rounded-2xl border border-border-default bg-bg-elevated px-7 shadow-card">
          <FaqItem question="Do I need an account?">
            No. {APP_NAME} works immediately — no signup, no email, no password. Just
            paste and publish.
          </FaqItem>
          <FaqItem question="Are published pages public?">
            Yes — they&apos;re accessible by anyone with the link. If you publish it,
            assume it can be forwarded.
          </FaqItem>
          <FaqItem question="How long do pages last?">
            30 days from the time of publishing. The page shows an expiry countdown at
            the top so your reader always knows.
          </FaqItem>
          <FaqItem question="Can I edit after publishing?">
            Not right now. Published pages are immutable snapshots. You can edit your
            local draft and republish — which creates a new link.
          </FaqItem>
          <FaqItem question="Can I export to PDF?">
            Use your browser&apos;s print function on the published page (File → Print
            or ⌘+P). It produces a clean PDF with no chrome.
          </FaqItem>
          <FaqItem question="Where are drafts stored?">
            Entirely in your browser&apos;s localStorage. Nothing is sent to a server
            until you deliberately hit Publish.
          </FaqItem>
          <FaqItem question="Is there an API?">
            Yes — Readable has a REST API and supports API key authentication for
            publishing programmatically from CI or scripts. Sign in to generate a key.
          </FaqItem>
        </div>
      </Section>

      <Container>
        <Divider />
      </Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Final CTA                                                             */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <Container>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="relative overflow-hidden rounded-3xl border border-accent/15 bg-bg-elevated px-8 py-16 text-center shadow-glow sm:px-16"
          >
            {/* Glow */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent opacity-[0.13] blur-[60px]" />
              <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-accent-soft opacity-[0.07] blur-2xl" />
            </div>

            <motion.div
              variants={reduce ? undefined : fadeUp}
              className="relative z-10"
            >
              <div className="text-2xs font-semibold tracking-[0.24em] uppercase text-accent">
                Get started
              </div>
              <h2 className="mt-4 text-balance text-[30px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[40px]">
                Paste once. Share a page people actually read.
              </h2>
              <p className="mx-auto mt-5 max-w-md text-[17px] leading-[1.72] text-text-secondary">
                Free. No account. Under 30 seconds.
              </p>
              <div className="mt-10 flex justify-center">
                <PrimaryButton
                  href={ROUTES.app}
                  large
                  onClick={() =>
                    trackEvent("open_editor_clicked", { location: "cta" })
                  }
                >
                  Open the editor
                  <svg width="14" height="14" fill="none" viewBox="0 0 12 12" aria-hidden>
                    <path
                      d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </PrimaryButton>
              </div>
            </motion.div>
          </motion.div>
        </Container>
      </section>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Footer                                                                */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border-default">
        <Container>
          <div className="flex flex-col items-center justify-between gap-5 py-10 sm:flex-row">
            <div className="flex items-center gap-3">
              <AppLogo onlyIcon={true} />
              <span className="text-[13px] text-text-muted">
                © {new Date().getFullYear()} {APP_NAME}. Built for clarity.
              </span>
            </div>
            <nav
              className="flex flex-wrap items-center justify-center gap-6 text-[13px] text-text-muted"
              aria-label="Footer navigation"
            >
              <Link href={ROUTES.app} className="transition hover:text-text-primary">
                Editor
              </Link>
              <a href="#features" className="transition hover:text-text-primary">
                Features
              </a>
              <a href="#how" className="transition hover:text-text-primary">
                How it works
              </a>
              <a href="#examples" className="transition hover:text-text-primary">
                Examples
              </a>
              <a href="#faq" className="transition hover:text-text-primary" onClick={(e) => {
                e.preventDefault();
                document.querySelector("[id='faq'], #faq, [data-faq]")?.scrollIntoView({ behavior: "smooth" });
              }}>
                FAQ
              </a>
            </nav>
          </div>
        </Container>
      </footer>
    </div>
  );
}
