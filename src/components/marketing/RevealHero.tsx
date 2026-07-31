"use client";

import { useRef } from "react";
import { useScroll, useTransform, motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/motion";

/**
 * "Precision Reveal" — a scroll-driven demonstration of Booklet's actual
 * product mechanic (raw Markdown syntax becoming clean, readable text),
 * told through opacity/weight/color choreography on a CONSTANT background,
 * not a color transformation toward a "paper" surface (the old "Ink & Paper"
 * concept this replaces). Syntax markers (`##`, `**`) dim to near-invisible
 * as scroll progresses; the prose they wrap gains full-opacity text-primary
 * color and, for the heading only, the brand accent — ending in a plain
 * hairline-bordered card, not a paper-toned one.
 *
 * DELIBERATELY uses the app's `usePrefersReducedMotion()` (src/lib/motion.ts)
 * here, NOT framer-motion's synchronous `useReducedMotion()`, even though
 * Task 8 established the latter as the fix for gating a mount-time branch
 * (framer's `initial` prop lag). That fix doesn't transfer to this component
 * — verified live, and it makes things *worse* here. Reasoning:
 *
 * This component's `if (reducedMotion) return ...` branches to a
 * structurally different tree (no `ref`, no `useScroll`) vs. Task 8's case,
 * which only ever varies an `initial` prop value on the *same* motion.div
 * tree shape. This page is SSR'd, and the server can never know the client's
 * `prefers-reduced-motion` setting either way — it always renders the
 * scroll-driven branch. With framer's *synchronous* hook, the client's very
 * first (hydration) render already disagrees with that server-rendered
 * markup, and because the two branches are different DOM shapes (one has
 * the `useScroll` target ref, one doesn't), React can't patch the mismatch
 * in place — it logs "Hydration failed ... this tree will be regenerated
 * on the client" and discards/remounts the subtree, which in turn made
 * framer's `useScroll` throw "Target ref is defined but not hydrated"
 * (motion.dev/troubleshooting/use-scroll-ref) during the brief mismatched
 * pass. None of that happens with `usePrefersReducedMotion`: it starts
 * `false` on both the server and the client's first render (matching
 * hydration exactly, since its real value only lands in a post-mount
 * effect), so hydration always succeeds cleanly against the scroll-driven
 * markup the server actually sent; the swap to the static branch then
 * happens as a completely ordinary post-mount re-render, not a hydration
 * correction — no console errors, no framer ref invariant. The two hooks'
 * user-visible "flash" windows end up the same size in practice (both are
 * bounded by the same unavoidable SSR-to-hydration gap, since neither hook
 * can know the real preference before the client mounts) — the difference
 * is purely in whether React gets there via a clean update or a logged
 * hydration-mismatch recovery. Task 8's fix is correct for its same-shape
 * case; it is the wrong tool for this component's two-different-DOM-shapes
 * case, so it is not applied here.
 */
const SAMPLE = {
  syntaxOpen: "## ",
  heading: "Incident Report",
  syntaxBoldOpen: "**",
  label: "Severity:",
  syntaxBoldClose: "** ",
  body: "P1, resolved in 13 minutes.",
};

export function RevealHero() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const progress = useTransform(scrollYProgress, [0.2, 0.6], [0, 1]);
  const syntaxOpacity = useTransform(progress, [0, 1], [1, 0]);
  const proseColor = useTransform(
    progress,
    [0, 1],
    ["var(--color-text-muted)", "var(--color-text-primary)"],
  );
  const headingColor = useTransform(
    progress,
    [0, 1],
    ["var(--color-text-muted)", "var(--color-accent)"],
  );
  const proseWeight = useTransform(progress, [0, 1], [400, 600]);

  if (reducedMotion) {
    // Render the fully-revealed end state statically — no scroll listener,
    // no interpolation, matching every other reduced-motion fallback.
    return (
      <div className="rounded-none border-y border-border-subtle px-6 py-24">
        <p className="max-w-2xl text-[clamp(20px,3.4vw,32px)] leading-normal font-semibold text-accent">
          {SAMPLE.heading}
        </p>
        <p className="mt-2 max-w-2xl text-[clamp(20px,3.4vw,32px)] leading-normal font-medium text-text-primary">
          <span className="font-semibold">{SAMPLE.label}</span> {SAMPLE.body}
        </p>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative h-[160vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden rounded-none border-y border-border-subtle px-6">
        <div className="max-w-2xl">
          <p className="text-[clamp(20px,3.4vw,32px)] leading-normal">
            <motion.span style={{ opacity: syntaxOpacity }} className="font-mono text-[0.75em] text-text-muted">
              {SAMPLE.syntaxOpen}
            </motion.span>
            <motion.span style={{ color: headingColor, fontWeight: proseWeight }}>
              {SAMPLE.heading}
            </motion.span>
          </p>
          <p className="mt-2 text-[clamp(20px,3.4vw,32px)] leading-normal">
            <motion.span style={{ opacity: syntaxOpacity }} className="font-mono text-[0.75em] text-text-muted">
              {SAMPLE.syntaxBoldOpen}
            </motion.span>
            <motion.span style={{ color: proseColor, fontWeight: proseWeight }}>{SAMPLE.label}</motion.span>
            <motion.span style={{ opacity: syntaxOpacity }} className="font-mono text-[0.75em] text-text-muted">
              {SAMPLE.syntaxBoldClose}
            </motion.span>
            <motion.span style={{ color: proseColor, fontWeight: proseWeight }}> {SAMPLE.body}</motion.span>
          </p>
        </div>
      </div>
    </div>
  );
}
