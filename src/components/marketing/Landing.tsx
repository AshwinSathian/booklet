"use client";

import { RevealHero } from "@/components/marketing/RevealHero";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { trackEvent } from "@/lib/analytics";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { useSession } from "@/components/auth/SessionProvider";
import type { Easing, Variants } from "framer-motion";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { CursorSpotlight } from "@/components/ui/CursorSpotlight";
import { DURATION, EASE_PRECISION } from "@/lib/motion";
import Link from "next/link";
import { type ReactNode, useMemo, useState, useCallback } from "react";
import { TEMPLATES } from "@/lib/templates";

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

// Hero-only stagger: tighter and snappier than `stagger`/`fadeUp` above (which
// remain the sitewide scroll-reveal used by every other section's `Section`
// wrapper) — the hero is the redesign's signature above-the-fold moment, so
// it uses the shared Precision motion primitives (DURATION/EASE_PRECISION)
// directly instead of the pre-existing ad hoc easing/duration values.
const heroStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const heroItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_PRECISION } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Layout primitives
// ─────────────────────────────────────────────────────────────────────────────

function Container({
  children,
  className,
}: {
  children: ReactNode;
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
  children: ReactNode;
  large?: boolean;
}) {
  return (
    <Button variant="primary" size={large ? "xl" : "lg"} href={href} onClick={onClick}>
      {children}
    </Button>
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
  children: ReactNode;
  external?: boolean;
}) {
  return (
    <Button variant="secondary" size="lg" href={href} external={external} onClick={onClick}>
      {children}
    </Button>
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
  children: ReactNode;
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
                "mt-3 text-balance text-[clamp(28px,4.5vw,40px)] leading-[1.14] font-bold tracking-[-0.025em]",
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

function FeatureIcon({ children }: { children: ReactNode }) {
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
  icon: ReactNode;
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
  children: ReactNode;
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
// Problem section mock — before (raw MD) vs after (Booklet page)
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

      {/* After: clean Booklet published page */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <svg width="9" height="9" fill="none" viewBox="0 0 12 12" aria-hidden>
              <path d="M2 6.5 4.5 9 10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-[12px] font-semibold text-text-muted">Shared as a Booklet link</span>
        </div>
        <div className="relative">
          {/* Signature accent — the one deliberate "this is now a booklet"
              cue: a thin amber rule along the after-card's top edge plus a
              small amber-tinted pill label, echoing the Precision system's
              single-accent restraint instead of a distinct paper tone. */}
          <div
            aria-hidden
            className="absolute -top-2.5 left-4 h-5 w-9 rounded-full border border-accent/30 bg-accent-dim"
          />
          <div className="relative overflow-hidden rounded-2xl border border-t-2 border-emerald-500/12 border-t-accent bg-bg-elevated shadow-card">
          {/* Browser bar */}
          <div className="flex items-center gap-2.5 border-b border-border-default bg-bg-soft px-4 py-2.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
            <span className="font-mono text-2xs text-text-muted truncate">
              booklet.ashwinsathian.com/p/Ab3k91QxZp
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
              desc: "Wire the REST API into your incident workflow — publish a post-mortem page straight from your on-call automation, no copy-paste, no formatting step.",
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
Authorization: Bearer bklt_...

{
  "blocks": [ ... ]
}

# Response
{
  "id": "Ab3k91QxZp",
  "url": "https://booklet.ashwinsathian.com/p/Ab3k91QxZp"
}

# Update an existing page (same URL)
PATCH /api/v1/pages/Ab3k91QxZp
Authorization: Bearer bklt_...`}
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
  // NOTE: gating the hero's stagger via lib/motion's `usePrefersReducedMotion`
  // was tried first and reverted — that hook deliberately starts `false` and
  // only syncs to the real media query in a post-mount effect (documented as
  // "SSR-safe"), but framer-motion's `initial` prop is evaluated once at
  // mount, so the correction arrives too late and the entrance animation
  // played anyway under reduced motion (verified live in-browser). Framer's
  // own `useReducedMotion` below resolves synchronously on first render
  // (it lazily reads `matchMedia` before its `useState` call), so it's the
  // one that actually gates correctly — and it's already the convention
  // every other section in this file uses for the same purpose.
  const reduce = useReducedMotion();
  const { isSignedIn, isLoaded } = useSession();

  const steps = useMemo(
    () => [
      {
        n: "01",
        title: "Write your Markdown",
        desc: "Type, paste, or import — notes, READMEs, incident updates, proposals, anything Markdown-shaped.",
      },
      {
        n: "02",
        title: "See it rendered instantly",
        desc: "Booklet formats headings, code, lists, and tables live as you type.",
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

  const [copiedMcp, setCopiedMcp] = useState(false);
  const handleCopyMcpConfig = useCallback(() => {
    const config = JSON.stringify(
      {
        mcpServers: {
          booklet: {
            url: "https://booklet-mcp.ashwinsathian.com/mcp",
            headers: { Authorization: "Bearer bklt_YOUR_KEY" },
          },
        },
      },
      null,
      2,
    );
    navigator.clipboard.writeText(config).then(() => {
      setCopiedMcp(true);
      setTimeout(() => setCopiedMcp(false), 2000);
    });
  }, []);

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
        desc: "Hit publish and get a clean URL in seconds. Drop it into Slack, email, a PR, or a ticket — it just works.",
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
            <path d="M12 20h9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        title: "Version history",
        desc: "Every publish creates a snapshot. Restore any of the last 50 versions of your page with one click from My Pages.",
      },
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="16" r="1" fill="currentColor" />
          </svg>
        ),
        title: "Password-protected pages",
        desc: "Restrict sensitive pages with a password. Readers enter it once and the page unlocks — the link stays shareable.",
      },
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        title: "REST API + MCP",
        desc: "Publish pages from CI/CD pipelines, scripts, or directly from Claude. Full API key management included.",
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
        href: "https://booklet.ashwinsathian.com/p/example-incident-report",
      },
      {
        tag: "ADR",
        title: "Design decisions",
        desc: "Architecture decisions and tradeoffs that make sense even to someone outside the codebase. No repo navigation required.",
        href: "https://booklet.ashwinsathian.com/p/example-adr",
      },
      {
        tag: "Docs",
        title: "README-style docs",
        desc: "Documentation you can share without sending someone to GitHub first. Clean URL, proper headings, code blocks intact.",
        href: "https://booklet.ashwinsathian.com/p/example-readme",
      },
      {
        tag: "Release",
        title: "Release notes",
        desc: "Ship a clean changelog your non-technical stakeholders can actually read. Publish directly from the CHANGELOG, no reformatting.",
      },
      {
        tag: "Onboarding",
        title: "Onboarding guides",
        desc: "New hire guides, team wikis, service runbooks. Drop the Booklet link in a welcome Slack message — zero setup for the reader.",
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

      <SiteHeader ctaTrackLocation="topbar" />

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Hero                                                                  */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* No section-level overflow-hidden: it would establish this <section>
          as the nearest ancestor "scroll container" for CSS position:sticky
          descendants (RevealHero's sticky reveal panel below) — since this
          section itself never scrolls, that silently breaks the sticky pin
          entirely. The ambient glow blobs below are clipped independently by
          their own inset-0 overflow-hidden wrapper, so nothing here relies on
          clipping at the section level. */}
      <section className="relative py-16 sm:py-28 lg:py-40">
        <CursorSpotlight />

        {/* Background ambient glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-48 left-1/2 h-150 w-150 -translate-x-1/2 rounded-full bg-accent opacity-[0.07] blur-[100px]" />
          <div className="absolute bottom-0 -left-24 h-87.5 w-87.5 rounded-full bg-accent opacity-[0.05] blur-[80px]" />
        </div>

        <Container>
          <motion.div
            variants={heroStagger}
            initial={reduce ? "show" : "hidden"}
            animate="show"
            className="relative z-10"
          >
            {/* Eyebrow */}
            <motion.div variants={heroItem}>
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-dim px-4 py-1.5 text-xs font-semibold tracking-wide text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Free · No account · Works with Claude
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={heroItem}
              className="mt-5 max-w-4xl text-balance text-[clamp(38px,8vw,80px)] font-extrabold leading-[1.02] tracking-[-0.04em]"
            >
              Written in Markdown.
              <br />
              <span className="text-accent">
                Read by everyone else.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={heroItem}
              className="mt-6 max-w-2xl text-pretty text-[18px] leading-[1.75] text-text-secondary"
            >
              Your incident reports, ADRs, and runbooks are already in Markdown. Booklet
              turns them into a clean page the PM, exec, or customer on the other end can
              actually open and read — no account, no formatting step, no raw asterisks.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={heroItem}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <PrimaryButton
                href={ROUTES.app}
                large
                onClick={() => trackEvent("open_editor_clicked", { location: "hero" })}
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

            {/* Keyboard hint — desktop only */}
            <motion.div
              variants={heroItem}
              className="mt-4 hidden sm:block text-[13px] text-text-muted"
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
            <RevealHero />
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
                <span className="font-semibold text-text-primary">Booklet</span> — write, publish, share a link. No account, no access to grant, no formatting step.
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
        title="Everything it needs to land well."
        subtitle="Every formatting detail handled. Your content arrives exactly as you wrote it — for anyone on the receiving end."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <motion.div key={f.title} variants={reduce ? undefined : fadeUp} className="h-full">
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
        title="Write. Preview. Publish. Share."
        subtitle="Four steps that fit inside your existing workflow. No new tool to learn — just a cleaner way to share what you already wrote."
      >
        <div className="flex flex-col gap-8 sm:flex-row sm:gap-0">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              variants={reduce ? undefined : fadeUp}
              className="relative flex-1 sm:px-6 sm:first:pl-0 sm:last:pr-0"
            >
              {i > 0 && (
                <div
                  aria-hidden
                  className="absolute top-5 left-0 hidden h-px w-6 -translate-x-full bg-border-strong sm:block"
                />
              )}
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-strong text-sm font-semibold text-accent">
                {i + 1}
              </div>
              <div className="mt-4 text-[15px] font-semibold tracking-tight">{step.title}</div>
              <div className="mt-2 text-[15px] leading-[1.72] text-text-secondary">{step.desc}</div>
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
        subtitle="If it ends up in Slack, email, or a ticket — it belongs in Booklet."
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
        subtitle="Booklet's REST API lets you publish pages directly from CI/CD pipelines, incident tools, and automation scripts. Sign in to generate a key."
      >
        <ApiBlock />
      </Section>

      <Container><Divider /></Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Integrations                                                          */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section
        id="integrations"
        eyebrow="CONNECT"
        title="Works where you already are."
        subtitle="Booklet connects to the tools in your workflow — publish directly from your AI assistant, your terminal, or your CI pipeline."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Claude MCP */}
          <motion.div variants={reduce ? undefined : fadeUp}>
            <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-elevated p-6 shadow-card transition hover:border-border-strong hover:bg-bg-soft h-full">
              {/* Claude brand icon — Anthropic's actual brand orange (#D97757), distinct from Booklet's new accent */}
              <div className="w-10 h-10 rounded-lg bg-[#D97757]/10 flex items-center justify-center text-[#D97757]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="text-[15px] font-semibold tracking-tight">Claude</div>
                <div className="text-[12px] text-text-muted mt-0.5">via MCP</div>
              </div>
              <div className="text-[15px] leading-[1.72] text-text-secondary">
                Add Booklet to Claude Desktop or Claude.ai. Then ask Claude to publish, update, or list your pages — all in plain language.
              </div>
              {/* Config snippet with copy button */}
              <div className="relative group">
                <pre className="text-[11px] font-mono bg-bg-soft border border-border-default rounded-lg px-3 py-3 text-text-muted overflow-x-auto leading-relaxed whitespace-pre">{`{
  "mcpServers": {

      "booklet": {
      "url": "https://booklet-mcp.ashwinsathian.com/mcp",
      "headers": { "Authorization": "Bearer bklt_YOUR_KEY" }
    }
  }
}`}</pre>
                <button
                  type="button"
                  onClick={handleCopyMcpConfig}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-bg-elevated border border-border-default opacity-0 group-hover:opacity-100 transition-all hover:bg-bg-soft text-text-muted hover:text-text-primary"
                  title={copiedMcp ? "Copied!" : "Copy config"}
                >
                  {copiedMcp ? (
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" aria-hidden>
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" aria-hidden>
                      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" />
                    </svg>
                  )}
                </button>
              </div>
              <Link
                href={ROUTES.mcpSetup}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent transition hover:text-accent-soft mt-auto"
                onClick={() => trackEvent("integration_clicked", { integration: "claude_mcp" })}
              >
                Add to Claude
                <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </motion.div>

          {/* Terminal / CLI */}
          <motion.div variants={reduce ? undefined : fadeUp}>
            <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-elevated p-6 shadow-card transition hover:border-border-strong hover:bg-bg-soft h-full">
              <div className="w-10 h-10 rounded-lg bg-accent-dim flex items-center justify-center text-accent">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M7 9l3 3-3 3M12 15h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="text-[15px] font-semibold tracking-tight">Terminal</div>
              <div className="text-[15px] leading-[1.72] text-text-secondary">
                <code className="text-[13px] font-mono">booklet-cli</code> publishes Markdown files from any terminal in one command. Works in CI too.
              </div>
              <code className="text-[12px] font-mono bg-bg-soft border border-border-default rounded-lg px-3 py-2 text-text-muted break-all">
                npx booklet-cli publish README.md
              </code>
              <a
                href="https://www.npmjs.com/package/booklet-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent transition hover:text-accent-soft mt-auto"
                onClick={() => trackEvent("integration_clicked", { integration: "cli" })}
              >
                View on npm
                <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </motion.div>

          {/* GitHub Actions */}
          <motion.div variants={reduce ? undefined : fadeUp}>
            <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-elevated p-6 shadow-card transition hover:border-border-strong hover:bg-bg-soft h-full">
              <div className="w-10 h-10 rounded-lg bg-accent-dim flex items-center justify-center text-accent">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="5" cy="19" r="2" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="19" cy="19" r="2" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M12 7v4M12 11l-5.5 6M12 11l5.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="text-[15px] font-semibold tracking-tight">GitHub Actions</div>
              <div className="text-[15px] leading-[1.72] text-text-secondary">
                Publish release notes, changelogs, or runbooks automatically on every push.
              </div>
              <a
                href="/api-docs#github-actions"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent transition hover:text-accent-soft mt-auto"
              >
                See recipe
                <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </motion.div>
        </div>
      </Section>

      <Container><Divider /></Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Templates                                                             */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section
        id="templates"
        eyebrow="Templates"
        title="Start with structure."
        subtitle="21 templates for the documents engineers and teams reach for most. Click one — the editor opens pre-loaded."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.filter((t) => t.slug).map((t) => (
            <motion.div key={t.slug} variants={reduce ? undefined : fadeUp} className="h-full">
              <Link
                href={`/templates/${t.slug}`}
                className="group flex flex-col gap-2 rounded-xl border border-border-default bg-bg-elevated p-5 shadow-card transition hover:border-border-strong hover:bg-bg-soft h-full"
              >
                {t.category && (
                  <span className="text-2xs font-medium uppercase tracking-wider text-text-muted">
                    {t.category}
                  </span>
                )}
                <p className="text-[14px] font-semibold text-text-primary group-hover:text-accent transition">
                  {t.name}
                </p>
                <p className="text-xs text-text-muted leading-relaxed flex-1">
                  {t.description}
                </p>
                <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition mt-1">
                  Use template →
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
        <motion.div
          variants={reduce ? undefined : fadeUp}
          className="mt-6 text-center"
        >
          <Link
            href="/templates"
            className="inline-flex items-center gap-1.5 text-sm text-accent transition hover:text-accent-soft"
          >
            Browse all templates
            <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
              <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </motion.div>
      </Section>

      <Container><Divider /></Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* All features included                                                 */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section
        id="all-features"
        eyebrow="Everything included"
        title="No feature is locked. No upgrade required."
        subtitle="Create a free account and every capability below is available — version history, analytics, password protection, the API, webhooks, MCP. All of it."
        center
      >
        <div className="mx-auto max-w-3xl">
          {[
            {
              group: "Writing & publishing",
              items: [
                "Live Markdown preview as you type",
                "Full GitHub-Flavored Markdown support",
                "Mermaid diagram rendering",
                "Formatting toolbar",
                "YAML frontmatter (title, author, date, tags)",
                "21 ready-to-use templates",
                "Unlimited local drafts, auto-saved to browser",
              ],
            },
            {
              group: "Pages & sharing",
              items: [
                "Unlimited pages (anonymous is capped at 10/month)",
                "Custom URL slugs",
                "Unlisted pages",
                "Password-protected pages",
                "Per-page analytics with read-depth",
                "Version history — restore any snapshot",
                "Auto Table of Contents on long documents",
              ],
            },
            {
              group: "Export & organisation",
              items: [
                "Export to Markdown, HTML, or PDF",
                "Collections — group and organise pages",
                "My Pages dashboard",
                "Reading time on every share page",
                "OG image for rich link previews",
              ],
            },
            {
              group: "API & integrations",
              items: [
                "REST API v1 — publish, update, list, delete",
                "API key management",
                "Publish webhooks (page.published, page.updated)",
                "Claude MCP server",
                "GitHub Actions integration",
                "Anonymous publishing — no account needed",
              ],
            },
          ].map(({ group, items }) => (
            <div key={group} className="mb-8 last:mb-0">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">
                {group}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8">
                {items.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden
                      className="mt-0.5 shrink-0 text-accent"
                    >
                      <path
                        d="M3 8l3.5 3.5 6.5-7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-sm text-text-secondary">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Container><Divider /></Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* FAQ                                                                   */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section id="faq" eyebrow="FAQ" title="Quick answers." center>
        <div className="mx-auto max-w-2xl rounded-2xl border border-border-default bg-bg-elevated px-7 shadow-card">
          <FaqItem question="Do I need an account?">
            No. {APP_NAME} works immediately — no signup, no email, no password. Just
            write and publish (up to 10 pages a month). Creating an account (free) removes
            that monthly cap and unlocks custom slugs, analytics, version history, the API,
            and My Pages. Pages are permanent either way.
            Everything is free — there is no paid plan.
          </FaqItem>
          <FaqItem question="Are published pages public?">
            Yes — they&apos;re accessible by anyone with the link. If you publish it,
            assume it can be forwarded. Signed-in users can mark pages as &ldquo;unlisted&rdquo; to
            hide them from any discovery while keeping the link functional.
          </FaqItem>
          <FaqItem question="How long do pages last?">
            Pages are permanent — there is no expiry. Anonymous pages stay live indefinitely;
            signed-in users additionally get the ability to edit, delete, and track views on
            their pages.
          </FaqItem>
          <FaqItem question="Can I edit after publishing?">
            Anonymous pages can&apos;t be edited after publishing — update your draft and republish for a new link.
            Signed-in users can update pages in place, keeping the same URL.
          </FaqItem>
          <FaqItem question="Can I export a published page?">
            Yes — every published page has an <strong>Export</strong> menu. Download the original Markdown source,
            a self-contained HTML file, or use Print or Save as PDF (⌘P) for a clean, chrome-free PDF.
          </FaqItem>
          <FaqItem question="Where are drafts stored?">
            Entirely in your browser. Nothing leaves your device until you hit Publish. Clearing browser storage removes local drafts.
          </FaqItem>
          <FaqItem question="Is there an API?">
            Yes. Publish pages directly from CI/CD pipelines, scripts, or automation — using a simple REST API.
            Sign in to generate a key from My Pages, then see the full{" "}
            <a href="/api-docs" className="text-accent hover:underline">API reference</a>.
          </FaqItem>
          <FaqItem question="What Markdown is supported?">
            Booklet supports GitHub-Flavored Markdown (GFM): H1–H4 headings, bold, italic,
            strikethrough, code (inline and fenced), tables, ordered/unordered/nested lists,
            task lists, blockquotes, links, images (external URLs), Mermaid diagrams, and
            KaTeX math — inline <strong>$...$</strong> and display <strong>$$...$$</strong>.
            HTML in Markdown is not rendered for security reasons.
          </FaqItem>
          <FaqItem question="Is there a size limit?">
            Up to 200,000 characters in the editor. Published pages are capped at 600 KB.
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
            className="relative overflow-hidden rounded-3xl border border-accent/15 bg-bg-elevated px-8 py-16 text-center shadow-card sm:px-16"
          >
            <CursorSpotlight />

            {/* Glow */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent opacity-[0.13] blur-[60px]" />
            </div>

            <motion.div variants={reduce ? undefined : fadeUp} className="relative z-10">
              <div className="text-2xs font-semibold tracking-[0.24em] uppercase text-accent">
                Get started
              </div>
              <h2 className="mt-4 text-balance text-[clamp(28px,4.5vw,40px)] font-bold leading-[1.12] tracking-[-0.025em]">
                Write once. Share a page people actually read.
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

      <SiteFooter />
    </div>
  );
}
