"use client";

import {
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionTemplate,
  useMotionValue,
  motion,
} from "framer-motion";
import { useRef } from "react";

// Fixed sample — deliberately not derived from live user content: this is a
// marketing demonstration of the transformation, not a live preview.
// Segments alternate between literal Markdown syntax (dimmed/dissolved as
// scroll progresses) and the prose it wraps (restyled from mono to
// Fraunces/paper as scroll progresses). See "Core creative concept" in
// docs/superpowers/specs/2026-07-28-visual-elevation-design.md.
type Segment = { text: string; kind: "syntax" | "prose" };

const SAMPLE: Segment[] = [
  { text: "## ", kind: "syntax" },
  { text: "Incident Report", kind: "prose" },
  { text: "\n\n", kind: "syntax" },
  { text: "**", kind: "syntax" },
  { text: "Severity:", kind: "prose" },
  { text: "**", kind: "syntax" },
  { text: " P1,", kind: "prose" },
  { text: " resolved in 13 minutes.", kind: "prose" },
];

export function RevealHero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Reduced-motion: skip straight to the fully-revealed (paper) end state,
  // no scroll-driven interpolation at all. Both motion values are always
  // created (never call hooks conditionally — see Rules of Hooks); which
  // one drives the animation is picked afterward.
  const revealedProgress = useMotionValue(1);
  const progress = reduce ? revealedProgress : scrollYProgress;
  // A useTransform call given a literal *array* input/output range (like
  // [0, 0.6] -> [1, 0]) gets hardware-accelerated by framer-motion for
  // "opacity" specifically (see motion-dom's acceleratedValues — opacity/
  // clipPath/filter/transform): it binds a native WAAPI Animation straight
  // to the DOM element in motion-dom/render/VisualElement.mjs's
  // bindToMotionValue, bypassing the normal per-frame JS update pipeline
  // entirely. In this component that accelerated path does not reproduce
  // useScroll's progress correctly for this sticky/scroll-linked setup —
  // verified live: computed opacity on the four syntax spans stayed at 1
  // through roughly the first third of the scroll range, then swept down
  // to ~0 and immediately back up to 1 by the very end, instead of the
  // intended monotonic 1->0 fade over progress 0->0.6 — while sibling
  // values driven by the same `progress` (fontWeight, the color-mix
  // template) tracked scroll correctly throughout, because font-weight/
  // color/background-color are never eligible for this accelerated path
  // and always go through the reliable per-frame JS route. Using the
  // *function* overload of useTransform (same pattern `mixPct` below
  // already uses) is categorically excluded from the accelerated path
  // (see use-transform.mjs's `typeof inputRangeOrTransformer !== "function"`
  // guard), which is what makes it — and this — reliable.
  const syntaxOpacity = useTransform(progress, (p) => Math.min(1, Math.max(0, 1 - p / 0.6)));
  const fontWeight = useTransform(progress, [0, 1], [400, 500]);

  // framer-motion's built-in color interpolation (useTransform between two
  // color strings) needs literal color values to mix numerically — it can't
  // blend two `var(--color-x)` references, which is what every color in
  // this codebase's token system is. Compositing the mix via CSS
  // `color-mix()` instead — evergreen-baseline supported (Chrome 111+,
  // Safari 16.4+, Firefox 113+) — lets the browser do the actual blend
  // while still reading the live theme-aware custom properties, so this
  // works correctly in both dark and light mode with zero theme branching.
  const mixPct = useTransform(progress, (p) => `${Math.round(p * 100)}%`);
  const containerBg = useMotionTemplate`color-mix(in srgb, var(--color-paper) ${mixPct}, var(--color-bg))`;
  const proseColor = useMotionTemplate`color-mix(in srgb, var(--color-paper-ink) ${mixPct}, var(--color-text-primary))`;

  return (
    <div ref={ref} className="relative h-[130vh] sm:h-[160vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <motion.div
          style={{ backgroundColor: containerBg }}
          className="flex h-full w-full items-center justify-center rounded-none border-y border-border-subtle px-6"
        >
          <motion.p
            style={{ color: proseColor, fontWeight }}
            className="max-w-2xl text-[clamp(20px,3.4vw,32px)] leading-normal font-display font-display-hero"
          >
            {SAMPLE.map((seg, i) =>
              seg.kind === "syntax" ? (
                <motion.span
                  key={i}
                  style={{ opacity: syntaxOpacity }}
                  className="font-mono text-[0.75em] text-text-muted"
                >
                  {seg.text}
                </motion.span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
