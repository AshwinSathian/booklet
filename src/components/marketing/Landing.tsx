"use client";

import { RevealHero } from "@/components/marketing/RevealHero";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { ROUTES } from "@/lib/constants";
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
            <pre className="overflow-hidden whitespace-pre-wrap font-mono text-[10.5px] leading-[1.72] text-text-muted select-none">
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
              <span className="text-text-muted"># was 50</span>
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
              title: "Release notes from CI",
              desc: "A GitHub Action publishes the notes when a release is tagged, and the job output has the link.",
            },
            {
              title: "Postmortems from your incident tooling",
              desc: "One POST with the Markdown publishes the page. Send an Idempotency-Key and a retried request does not publish it twice.",
            },
            {
              title: "Update pages in place",
              desc: "PATCH a page with new Markdown and the URL stays the same. Each update is kept as a version you can diff and restore.",
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
          <PrimaryButton href={ROUTES.signIn}>
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
          <pre tabIndex={0} className="overflow-x-auto font-mono text-[12px] leading-[1.78] text-text-secondary">
{`# Publish a new page
POST /api/v1/publish
Authorization: Bearer bklt_...

{
  "raw": "# Release notes\n\n..."
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
        desc: "Type it, paste it, import a file, or start from a template for an incident report, ADR, RFC or runbook.",
      },
      {
        n: "02",
        title: "Check the preview",
        desc: "The preview beside the editor is the page your reader will get: headings, code, tables, diagrams and math.",
      },
      {
        n: "03",
        title: "Publish",
        desc: "You get a link. A new page is unlisted, so it stays out of search engines until you make it public.",
      },
      {
        n: "04",
        title: "Send the link",
        desc: "Slack, email, a ticket. The reader needs a browser and nothing else.",
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
        desc: "The rendered page updates beside the editor while you write, and it is the same page your reader gets.",
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
        title: "One link per document",
        desc: "Publish and you have a URL for Slack, email, a pull request or a ticket. With an account you can give it a slug of your own.",
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
        title: "Formatted for you",
        desc: "Headings, code blocks, tables and callouts are typeset without any CSS from you. Five document themes if you want a different look.",
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
        title: "Drafts stay yours",
        desc: "A draft is saved in your browser. Signed in, it also syncs to your account. Nobody else can see it until you publish.",
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
        title: "Diagrams and math",
        desc: "A fenced Mermaid or Graphviz block is drawn as a diagram, and KaTeX math is typeset, in the page and in the HTML export.",
      },
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 20h9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        title: "Version history",
        desc: "Every publish keeps a snapshot, up to 50 per page. Compare any two line by line, and restore one as a new version.",
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
        desc: "Put a password on a page and readers are asked for it once. The link itself does not change.",
      },
      {
        icon: (
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
            <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
        title: "API, CLI and MCP",
        desc: "Publish from a script, a CI job or an MCP client such as Claude. Keys are made and revoked in Settings.",
      },
    ],
    [],
  );

  const useCases = useMemo(
    () => [
      {
        tag: "Incident",
        title: "Incident summaries",
        desc: "Timeline, severity and root cause on one page, with status and owners in a strip at the top. Send the link when the incident closes.",
        href: "https://booklet.ashwinsathian.com/p/example-incident-report",
      },
      {
        tag: "ADR",
        title: "Design decisions",
        desc: "The decision, its status and what it supersedes, readable by someone who has never opened the repository.",
        href: "https://booklet.ashwinsathian.com/p/example-adr",
      },
      {
        tag: "Docs",
        title: "README-style docs",
        desc: "A README as a page of its own, for the reader who has no reason to visit GitHub.",
        href: "https://booklet.ashwinsathian.com/p/example-readme",
      },
      {
        tag: "Release",
        title: "Release notes",
        desc: "Publish the changelog entry as it is. The GitHub Action does it on every tagged release.",
      },
      {
        tag: "Runbook",
        title: "Runbooks",
        desc: "Steps the person on call can follow at 3am, on a page that loads on a phone.",
      },
      {
        tag: "RFC",
        title: "RFCs",
        desc: "The proposal, its status and its owners. Link it from the ADR that came out of it.",
      },
    ],
    [],
  );

  return (
    <div className="relative min-h-screen bg-bg text-text-primary">

      <SiteHeader />

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
                Free · Incident reports, ADRs, RFCs, runbooks
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={heroItem}
              className="mt-5 max-w-4xl text-balance text-[clamp(38px,8vw,80px)] font-extrabold leading-[1.02] tracking-[-0.04em]"
            >
              Engineering documents,
              <br />
              <span className="text-accent">
                published as pages.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              variants={heroItem}
              className="mt-6 max-w-2xl text-pretty text-[18px] leading-[1.75] text-text-secondary"
            >
              Write an incident report, ADR, RFC or runbook in Markdown and publish it as a
              page anyone can open. Keep them together in a team space, where an incident
              links to the ADR behind it and some pages are for members alone. You don&apos;t
              need an account to try it.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={heroItem}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <PrimaryButton
                href={ROUTES.app}
                large
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
                See example pages
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

            {/* Secondary CTA — the agent/CI publishing path. Links to the
                on-page API/CLI/MCP section (#api), which covers both AI
                assistants and CI/CD — not /mcp-setup, which only covers the
                AI-assistant half of this claim. */}
            <motion.div variants={heroItem} className="mt-3 text-[13px]">
              <a
                href="#api"
                className="inline-flex items-center gap-1.5 text-text-muted transition hover:text-accent"
              >
                or publish from the CLI, the API, a GitHub Action or an MCP client
                <svg width="10" height="10" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path
                    d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
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
        subtitle="Paste Markdown into Slack, email or a ticket and the reader gets pound signs and asterisks. The table you wrote arrives as rows of pipes."
      >
        <ProblemMock />
      </Section>

      <Container><Divider /></Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Engineering documents and team spaces                                 */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section
        id="teams"
        eyebrow="For engineering teams"
        title="Incident reports, ADRs, RFCs and runbooks, in one space."
        subtitle="A team space is a shared place for a team's documents. You create one, invite people by email, and publish into it from the editor, the CLI, the API or an MCP client."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div variants={reduce ? undefined : fadeUp} className="h-full">
            <FeatureCard
              icon={
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <path d="M4 5h16M4 5v14h16V5M4 10h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              title="Document types"
              desc="Put type: incident, postmortem, adr, rfc, runbook or release-notes in the frontmatter. The page shows status, severity, date and owners in a strip under the title."
            />
          </motion.div>
          <motion.div variants={reduce ? undefined : fadeUp} className="h-full">
            <FeatureCard
              icon={
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              title="Links between documents"
              desc="Write [[ADR-012 Queue retries]] in an incident report and it links to that ADR when you publish. The ADR lists the incident under Referenced by."
            />
          </motion.div>
          <motion.div variants={reduce ? undefined : fadeUp} className="h-full">
            <FeatureCard
              icon={
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <path d="M16 11V8a4 4 0 0 0-8 0v3M6 11h12v9H6z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              title="Pages for the team"
              desc="Set a page in a team space to Team and its members can open it. Anyone else gets a 404, and the page is never indexed."
            />
          </motion.div>
          <motion.div variants={reduce ? undefined : fadeUp} className="h-full">
            <FeatureCard
              icon={
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <path d="M4 6h7v5H4zM13 6h7v5h-7zM4 13h7v5H4zM13 13h7v5h-7z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              title="A home for the space"
              desc="The space lists its pages by type: a decision log in ADR-number order, incidents by date. Public pages get an Atom feed."
            />
          </motion.div>
        </div>
        {isLoaded && isSignedIn ? (
          <div className="mt-8">
            <GhostButton href={ROUTES.spaces}>Open your spaces</GhostButton>
          </div>
        ) : null}
      </Section>

      <Container><Divider /></Container>

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Features                                                              */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      <Section
        id="features"
        eyebrow="Features"
        title="What every page gets."
        subtitle="These work for any Markdown you publish, typed or not."
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
        subtitle="From the editor it takes four steps."
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
        title="Example pages."
        subtitle="Three of these link to live pages. Open one to see what a reader gets."
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
        eyebrow="API · CLI · MCP"
        title="Five ways to publish."
        subtitle="The editor, the REST API, the CLI, a GitHub Action and an MCP server all produce the same page. The API, CLI and Action use an API key from Settings. An MCP client signs in with OAuth or uses a key."
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
        title="Claude, the terminal, GitHub Actions."
        subtitle="Setup for each of the three takes a few minutes."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Claude MCP */}
          <motion.div variants={reduce ? undefined : fadeUp}>
            <div className="flex flex-col gap-4 rounded-xl border border-border-default bg-bg-elevated p-6 shadow-card transition hover:border-border-strong hover:bg-bg-soft h-full">
              {/* Claude brand icon — Anthropic's actual brand orange (#D97757), distinct from Booklet's new accent */}
              <div className="w-10 h-10 rounded-lg bg-[#D97757]/10 flex items-center justify-center text-[#D97757] [.light_&]:text-[#8f4017]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <div className="text-[15px] font-semibold tracking-tight">Claude</div>
                <div className="text-[12px] text-text-muted mt-0.5">via MCP</div>
              </div>
              <div className="text-[15px] leading-[1.72] text-text-secondary">
                In Claude.ai, add Booklet as a custom connector and sign in. Claude Desktop and other MCP clients take the config below with an API key. Then ask for a page to be published, updated or found.
              </div>
              {/* Config snippet with copy button */}
              <div className="relative group">
                <pre tabIndex={0} className="text-[11px] font-mono bg-bg-soft border border-border-default rounded-lg px-3 py-3 text-text-muted overflow-x-auto leading-relaxed whitespace-pre">{`{
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
                <code className="text-[13px] font-mono">booklet-cli</code> publishes a Markdown file with one command, pulls a page back as Markdown, and has JSON output and exit codes for scripts.
              </div>
              <code className="text-[12px] font-mono bg-bg-soft border border-border-default rounded-lg px-3 py-2 text-text-muted break-all">
                npx booklet-cli publish README.md
              </code>
              <a
                href="https://www.npmjs.com/package/booklet-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent transition hover:text-accent-soft mt-auto"
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
                Publish release notes, changelogs or runbooks from a workflow. A re-run of the same job updates nothing twice.
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
        title="Start from a template."
        subtitle="21 templates. Pick one and the editor opens with it loaded, frontmatter included."
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
        title="Everything is in the free account."
        subtitle="There is no paid plan and nothing to upgrade to. An account gets all of this."
        center
      >
        <div className="mx-auto max-w-3xl">
          {[
            {
              group: "Writing & publishing",
              items: [
                "Live Markdown preview as you type",
                "GitHub-Flavored Markdown, KaTeX math, Graphviz",
                "Mermaid diagram rendering",
                "Formatting toolbar",
                "YAML frontmatter (type, status, owners, tags and more)",
                "21 ready-to-use templates",
                "Drafts saved in the browser, synced to your account when signed in",
              ],
            },
            {
              group: "Pages & sharing",
              items: [
                "Pages without a monthly cap (10 a month with no account)",
                "Custom URL slugs",
                "Unlisted pages (the default), public pages, pages for a team",
                "Password-protected pages",
                "Per-page views, and how many readers reached 50% and 100%",
                "Version history with line diff and restore",
                "Auto Table of Contents on long documents",
              ],
            },
            {
              group: "Export & organisation",
              items: [
                "Export to Markdown or self-contained HTML, and Print to PDF",
                "Folders, and team spaces grouped by document type",
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
                "MCP server, with OAuth sign-in or an API key",
                "GitHub Action and the booklet-cli npm package",
                "Import a Markdown file from a GitHub URL",
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
            No. You can write and publish up to 10 pages a month without one, and those pages
            are kept for 90 days. A free account removes both limits and adds editing in place,
            custom slugs, analytics, version history, team spaces and API keys. There is no paid plan.
          </FaqItem>
          <FaqItem question="Are published pages public?">
            Anyone with the link can read a page, so assume it can be forwarded. New pages
            are unlisted: they stay out of Explore and search engines unless you choose
            &ldquo;Public&rdquo; when you publish.
          </FaqItem>
          <FaqItem question="How long do pages last?">
            A page under an account stays until you delete it. A page published without an
            account is kept for 90 days. To keep one longer, open it in the browser you
            published it from, sign in, and choose &ldquo;Keep this page&rdquo;.
          </FaqItem>
          <FaqItem question="Can I edit after publishing?">
            With an account, yes: update the page and the URL stays the same. A page published
            without an account can&apos;t be changed; publish the draft again and you get a new link.
          </FaqItem>
          <FaqItem question="Can I export a published page?">
            Yes. The <strong>Export</strong> menu on a published page gives you the Markdown source or a
            self-contained HTML file, and Print to PDF uses your browser&apos;s print dialog. Math and
            diagrams are drawn into the HTML file, so it opens offline.
          </FaqItem>
          <FaqItem question="Where are drafts stored?">
            In your browser. If you are signed in they also sync to your account, so they follow
            you to another device. Without an account, clearing browser storage removes them.
          </FaqItem>
          <FaqItem question="Is there an API?">
            Yes, a REST API for publishing, updating, listing and deleting pages. Create a key
            under Settings, API keys, then see the{" "}
            <a href="/api-docs" className="text-accent underline underline-offset-2">API reference</a>.
          </FaqItem>
          <FaqItem question="What Markdown is supported?">
            GitHub-Flavored Markdown: headings, bold, italic,
            strikethrough, code (inline and fenced), tables, ordered/unordered/nested lists,
            task lists, blockquotes, links, images (external URLs), Mermaid and Graphviz diagrams, and
            KaTeX math — inline <strong>$...$</strong> and display <strong>$$...$$</strong>.
            Raw HTML in Markdown is not rendered.
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
                Publish the next incident report as a page.
              </h2>
              <p className="mx-auto mt-5 max-w-md text-[17px] leading-[1.72] text-text-secondary">
                Free, and you can try it without an account.
              </p>
              <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <PrimaryButton
                  href={ROUTES.app}
                  large
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
                  <GhostButton href={ROUTES.signUp}>
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
