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
// Feature cards
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
// Example / use-case cards
// ─────────────────────────────────────────────────────────────────────────────

function ExampleCard({
  title,
  desc,
  href,
  tag,
}: {
  title: string;
  desc: string;
  href?: string;
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
      {href ? (
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
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAQ
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
// Hero product mock — split-pane editor showing MD → rendered page
// ─────────────────────────────────────────────────────────────────────────────

function HeroMock() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-default bg-bg-elevated shadow-glass">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border-default bg-bg-soft px-4 py-3">
        {/* macOS traffic-light dots — intentional literal colours, not design tokens */}
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
        {/* Markdown editor */}
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

        {/* Rendered preview */}
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
// Problem section mock — before (raw MD) vs after (Readable page)
// ─────────────────────────────────────────────────────────────────────────────

function ProblemMock() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* Before: raw Markdown in a chat/message context */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15 text-red-400">
            <svg width="9" height="9" fill="none" viewBox="0 0 12 12" aria-hidden>
              <path d="M6 1v5M6 9v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <span className="text-[12px] font-semibold text-text-muted">Pasted into chat or email</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-red-500/12 bg-bg-elevated shadow-card">
          <div className="flex items-center gap-2.5 border-b border-border-default bg-bg-soft px-4 py-2.5">
            <div className="h-6 w-6 rounded-full bg-fill-3 shrink-0" />
            <div>
              <div className="text-2xs font-semibold text-text-primary">Sarah</div>
              <div className="text-[9px] text-text-muted">12:47 PM</div>
            </div>
          </div>
          <div className="p-5">
            <div className="text-[11px] text-text-secondary mb-3">Here&apos;s the incident summary:</div>
            <pre className="overflow-hidden whitespace-pre-wrap font-mono text-[10.5px] leading-[1.72] text-text-muted/90 select-none">
{`## Incident Report

**Severity:** P1
**Status:** Resolved

### Timeline

- 14:32 Alert triggered
- 14:45 Root cause found
- 15:01 Fix deployed

### Root Cause

DB pool exhausted after Tuesday's deploy.

\`\`\`yaml
pool_size: 5 # was 50
\`\`\``}
            </pre>
          </div>
        </div>
      </div>

      {/* After: clean Readable published page */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <svg width="9" height="9" fill="none" viewBox="0 0 12 12" aria-hidden>
              <path d="M2 6.5 4.5 9 10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-[12px] font-semibold text-text-muted">Shared as a Readable link</span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-emerald-500/12 bg-bg-elevated shadow-card">
          {/* Browser bar */}
          <div className="flex items-center gap-2.5 border-b border-border-default bg-bg-soft px-4 py-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
            <span className="font-mono text-2xs text-text-muted truncate">
              readable.app/p/Ab3k91QxZp
            </span>
          </div>
          {/* Clean rendered content */}
          <div className="p-5">
            <div className="text-[14px] font-bold tracking-tight text-text-primary">
              Incident Report
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="inline-flex rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[9px] font-semibold text-red-400">
                P1 Severity
              </span>
              <span className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
                Resolved
              </span>
            </div>
            <div className="mt-3.5 text-[11px] font-semibold text-text-primary">Timeline</div>
            <ul className="mt-1.5 space-y-1">
              {["14:32 — Alert triggered", "14:45 — Root cause found", "15:01 — Fix deployed"].map((t) => (
                <li key={t} className="flex items-start gap-2 text-2xs text-text-secondary">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-3.5 text-[11px] font-semibold text-text-primary">Root Cause</div>
            <div className="mt-1 text-2xs leading-[1.65] text-text-secondary">
              DB pool exhausted after Tuesday&apos;s deploy.
            </div>
            <div className="mt-2.5 rounded-lg border border-border-default bg-bg px-3 py-2 font-mono text-2xs text-text-muted">
              <span className="text-accent-soft">pool_size</span>
              {": 5  "}
              <span className="text-text-muted/60"># was 50</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// API section — code block + feature list
// ─────────────────────────────────────────────────────────────────────────────

function ApiBlock() {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 items-center">
      {/* Description */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          {[
            {
              title: "Auto-publish release notes",
              desc: "Trigger a publish from your GitHub Action after every tagged release. The link is always ready before your team announcement.",
            },
            {
              title: "Incident tooling integration",
              desc: "Publish a post-mortem page directly from PagerDuty, Opsgenie, or your on-call runbook — no copy-paste, no formatting step.",
            },
            {
              title: "Update pages in place",
              desc: "PATCH an existing page with new content. The URL stays the same — bookmark it once, always current.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-4">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-dim text-accent">
                <svg width="9" height="9" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2 6.5 4.5 9 10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="text-[14px] font-semibold tracking-tight">{item.title}</div>
                <div className="mt-1 text-[14px] leading-[1.7] text-text-secondary">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <PrimaryButton href={ROUTES.signIn} onClick={() => trackEvent("api_cta_clicked")}>
            Get an API key
            <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
              <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </PrimaryButton>
        </div>
      </div>

      {/* Code block */}
      <div className="overflow-hidden rounded-2xl border border-border-default bg-bg-elevated shadow-card">
        <div className="flex items-center gap-2 border-b border-border-default bg-bg-soft px-4 py-3">
          {/* macOS traffic-light dots — intentional literal colours, not design tokens */}
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="ml-2 font-mono text-2xs text-text-muted">REST API</span>
        </div>
        <div className="p-5">
          <pre className="overflow-x-auto font-mono text-[12px] leading-[1.78] text-text-secondary">
{`# Publish a new page
POST /api/v1/publish
Authorization: Bearer rdbl_...

{
  "blocks": [ ... ]
}

# Response
{
  "id": "Ab3k91QxZp",
  "url": "https://readable.app/p/Ab3k91QxZp"
}

# Update an existing page (same URL)
PATCH /api/v1/pages/Ab3k91QxZp
Authorization: Bearer rdbl_...`}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Landing component
// ─────────────────────────────────────────────────────────────────────────────

export function Landing() {
  const reduce = useReducedMotion();
  const { isSignedIn, isLoaded } = useUser();

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
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
        title: "Auto Table of Contents",
        desc: "Documents with three or more headings get a scroll-tracked navigation sidebar on desktop, accordion on mobile.",
      },
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M17 21v-8H7v8M7 3v5h8"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
        title: "Multiple drafts",
        desc: "Keep all your work organized. Unlimited named drafts, auto-saved to your browser, persistent across sessions.",
      },
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.75" />
            <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
            <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.75" />
            <path
              d="M8.59 13.51 15.42 17.49M15.41 6.51 8.59 10.49"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ),
        title: "Mermaid diagrams",
        desc: "Flowcharts, sequence diagrams, architecture diagrams — all rendered inline from fenced Mermaid code blocks.",
      },
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <path d="M4 7V4h16v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 20h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 4v16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 12h3M16 12h3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        title: "Formatting toolbar",
        desc: "Not sure about the syntax? Bold, italic, headings, links, code blocks — one click inserts the right Markdown. Works on your selection.",
      },
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        ),
        title: "Export from the share page",
        desc: "Download the original Markdown source, a self-contained HTML file, or print to PDF — right from the published page.",
      },
    ],
    [],
  );

  const useCases = useMemo(
    () => [
      {
        tag: "Incident",
        title: "Incident summaries",
        desc: "Timeline, severity, root cause, next steps — structured enough to forward to leadership the moment the incident closes.",
        href: "https://readable.ashwinsathian.com/p/GqfTrJQg0t",
      },
      {
        tag: "ADR",
        title: "Design decisions",
        desc: "Architecture decisions and tradeoffs that make sense even to someone outside the codebase. No repo navigation required.",
        href: "https://readable.ashwinsathian.com/p/Vmm78unhPg",
      },
      {
        tag: "Docs",
        title: "README-style docs",
        desc: "Documentation you can share without sending someone to GitHub first. Clean URL, proper headings, code blocks intact.",
        href: "https://readable.ashwinsathian.com/p/6MTZfx3M6q",
      },
      {
        tag: "Release",
        title: "Release notes",
        desc: "Ship a clean changelog your non-technical stakeholders can actually read. Publish directly from the CHANGELOG, no reformatting.",
      },
      {
        tag: "Onboarding",
        title: "Onboarding guides",
        desc: "New hire guides, team wikis, service runbooks. Paste the Readable link in a welcome Slack message — zero setup for the reader.",
      },
      {
        tag: "Proposal",
        title: "Proposals & briefs",
        desc: "Write in Markdown, skip the Google Docs formatting step. Send a clean, professional link that opens in any browser.",
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
              <Link
                href="/api-docs"
                className="text-sm text-text-muted transition hover:text-text-primary"
              >
                API
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {/* Fixed-width slot avoids CLS while Clerk resolves auth state */}
              <div className="w-18 flex justify-end">
                {!isLoaded ? null : isSignedIn ? (
                  <UserButton />
                ) : (
                  <GhostButton href={ROUTES.signIn}>Sign in</GhostButton>
                )}
              </div>
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

            {/* Headline */}
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

      <Container><Divider /></Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* The problem                                                           */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section
        id="problem"
        eyebrow="The problem"
        title="Raw Markdown doesn't travel well."
        subtitle="When engineers share Markdown outside their team — in Slack, email, a ticket — the recipient sees syntax noise, not a document. Structure is lost. The message is harder to act on."
      >
        <ProblemMock />

        {/* Alternatives callout */}
        <motion.div variants={reduce ? undefined : fadeUp} className="mt-10">
          <div className="rounded-2xl border border-border-default bg-bg-elevated p-6 sm:p-8">
            <div className="text-[13px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-5">
              The usual alternatives
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { tool: "Google Docs", why: "Requires a Google account" },
                { tool: "Notion", why: "Requires workspace access" },
                { tool: "Confluence", why: "Requires corporate SSO" },
                { tool: "GitHub Gist", why: "Poor rendering, GitHub account" },
                { tool: "HackMD / StackEdit", why: "Collaborative overkill" },
                { tool: "Paste into Slack", why: "Destroys all formatting" },
              ].map(({ tool, why }) => (
                <div key={tool} className="flex items-start gap-3">
                  <svg className="mt-0.5 shrink-0 text-red-400/60" width="14" height="14" fill="none" viewBox="0 0 14 14" aria-hidden>
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <div>
                    <span className="text-[13px] font-medium text-text-primary">{tool}</span>
                    <span className="text-[13px] text-text-muted"> — {why}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3 rounded-xl border border-accent/20 bg-accent-dim px-4 py-3">
              <svg className="shrink-0 text-accent" width="16" height="16" fill="none" viewBox="0 0 24 24" aria-hidden>
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[14px] text-text-secondary">
                <span className="font-semibold text-text-primary">Readable</span> — paste, publish, share a link. No account, no access to grant, no formatting step.
              </span>
            </div>
          </div>
        </motion.div>
      </Section>

      <Container><Divider /></Container>

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

      <Container><Divider /></Container>

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

      <Container><Divider /></Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Examples / Use cases                                                  */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section
        id="examples"
        eyebrow="Examples"
        title="Real pages, real use cases."
        subtitle="If it gets pasted into Slack, emailed, or dropped into a ticket — it belongs in Readable."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.map((c) => (
            <motion.div key={c.tag} variants={reduce ? undefined : fadeUp}>
              <ExampleCard {...c} />
            </motion.div>
          ))}
        </div>
      </Section>

      <Container><Divider /></Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* API & automation                                                       */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section
        id="api"
        eyebrow="API"
        title="Publish from anywhere."
        subtitle="Readable's REST API lets you publish pages directly from CI/CD pipelines, incident tools, and automation scripts. Sign in to generate a key."
      >
        <ApiBlock />
      </Section>

      <Container><Divider /></Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* FAQ                                                                   */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section id="faq" eyebrow="FAQ" title="Quick answers." center>
        <div className="mx-auto max-w-2xl rounded-2xl border border-border-default bg-bg-elevated px-7 shadow-card">
          <FaqItem question="Do I need an account?">
            No. {APP_NAME} works immediately — no signup, no email, no password. Just
            paste and publish. A free account unlocks permanent pages, custom slugs,
            view counts, the My Pages dashboard, and API access.
          </FaqItem>
          <FaqItem question="Are published pages public?">
            Yes — they&apos;re accessible by anyone with the link. If you publish it,
            assume it can be forwarded. Signed-in users can mark pages as &ldquo;unlisted&rdquo; to
            hide them from any discovery while keeping the link functional.
          </FaqItem>
          <FaqItem question="How long do pages last?">
            30 days from the time of publishing for anonymous pages. The page shows an expiry
            countdown badge so your reader always knows. Signed-in users get permanent pages
            that never expire.
          </FaqItem>
          <FaqItem question="Can I edit after publishing?">
            Anonymous pages are immutable — edit your local draft and republish to get a new link.
            Signed-in users can use the API to republish updated content to the same page ID,
            keeping the URL unchanged.
          </FaqItem>
          <FaqItem question="Can I export a published page?">
            Yes — the share page has an <strong>Export</strong> menu with three options: download the original
            Markdown source (available for pages published recently), download a self-contained HTML file
            with inline styles, or use Print / Save as PDF (File → Print or ⌘+P) for a clean,
            chrome-free PDF.
          </FaqItem>
          <FaqItem question="Where are drafts stored?">
            Entirely in your browser&apos;s localStorage. Nothing is sent to a server
            until you deliberately hit Publish. Clearing your browser&apos;s storage will delete local drafts.
          </FaqItem>
          <FaqItem question="Is there an API?">
            Yes — Readable has a REST API for publishing pages programmatically.{" "}
            <code className="rounded bg-fill-2 px-1 py-0.5 font-mono text-xs">POST /api/v1/publish</code>{" "}
            creates a new page;{" "}
            <code className="rounded bg-fill-2 px-1 py-0.5 font-mono text-xs">PATCH /api/v1/pages/{"{id}"}</code>{" "}
            updates an existing one. Sign in to generate an API key from the My Pages dashboard.
          </FaqItem>
          <FaqItem question="What Markdown is supported?">
            Readable supports GitHub-Flavored Markdown (GFM): H1–H4 headings, bold, italic,
            strikethrough, code (inline and fenced), tables, ordered/unordered/nested lists,
            task lists, blockquotes, links, images (external URLs), and Mermaid diagrams.
            HTML in Markdown is not rendered for security reasons.
          </FaqItem>
          <FaqItem question="Is there a size limit?">
            The editor accepts up to 200,000 characters. Published page payloads are capped at
            600,000 bytes to keep edge storage fast.
          </FaqItem>
        </div>
      </Section>

      <Container><Divider /></Container>

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

            <motion.div variants={reduce ? undefined : fadeUp} className="relative z-10">
              <div className="text-2xs font-semibold tracking-[0.24em] uppercase text-accent">
                Get started
              </div>
              <h2 className="mt-4 text-balance text-[30px] font-bold leading-[1.12] tracking-[-0.03em] sm:text-[40px]">
                Paste once. Share a page people actually read.
              </h2>
              <p className="mx-auto mt-5 max-w-md text-[17px] leading-[1.72] text-text-secondary">
                Free. No account. Under 30 seconds.
              </p>
              <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <PrimaryButton
                  href={ROUTES.app}
                  large
                  onClick={() => trackEvent("open_editor_clicked", { location: "cta" })}
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
                {isLoaded && !isSignedIn && (
                  <GhostButton href={ROUTES.signUp} onClick={() => trackEvent("sign_up_clicked", { location: "cta" })}>
                    Create a free account
                  </GhostButton>
                )}
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
              <a href="#api" className="transition hover:text-text-primary">
                API
              </a>
              <a href="#faq" className="transition hover:text-text-primary">
                FAQ
              </a>
              <Link href="/api-docs" className="transition hover:text-text-primary">
                API docs
              </Link>
            </nav>
          </div>
        </Container>
      </footer>
    </div>
  );
}
