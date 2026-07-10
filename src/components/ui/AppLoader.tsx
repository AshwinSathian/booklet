"use client";

import { useEffect, useState } from "react";

// AppLoader is a pure branding moment, not a real loading indicator: the
// real editor (AppPageContent) mounts as its sibling in AppClient, already
// fully ready underneath this overlay — there is no actual multi-stage
// async process happening while this displays. The previous version staged
// four fake status messages ("Loading editor…", "Restoring drafts…",
// "Preparing workspace…", "Ready.") on a fixed timer, narrating work that
// wasn't really happening in that sequence, and held every user for a
// mandatory ~1.7s regardless. This version is honest about being a brief
// brand flash, not a progress report, and is much shorter.
const EXIT_MS = 450;
const FADE_MS = 220;

type Phase = "pre" | "entering" | "exiting" | "done";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export function AppLoader() {
  const [phase, setPhase] = useState<Phase>("pre");

  useEffect(() => {
    // No real loading is masked here (see comment above) — someone who's
    // asked for reduced motion shouldn't be held on a mandatory delay for a
    // decorative flash, so skip it entirely.
    if (prefersReducedMotion()) {
      setPhase("done");
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    let rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => setPhase("entering"));
    });

    timers.push(setTimeout(() => setPhase("exiting"), EXIT_MS));
    // Hard fallback — dismisses the overlay even if onTransitionEnd never fires
    // (React applying transition + opacity simultaneously can prevent transitionend)
    timers.push(setTimeout(() => setPhase("done"), EXIT_MS + FADE_MS + 200));

    return () => {
      cancelAnimationFrame(rafId);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === "done") return null;

  const isEntered = phase === "entering" || phase === "exiting";
  const isExiting = phase === "exiting";

  return (
    <div
      aria-hidden
      // Keep transition always set so the browser has it ready when opacity changes.
      // If both transition + opacity were set simultaneously React can cause transitionend
      // to never fire — the always-on transition prevents that race.
      style={{
        opacity: isExiting ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease-out`,
        pointerEvents: isExiting ? "none" : "all",
      }}
      onTransitionEnd={(e) => {
        // Guard against child transitionend events bubbling up
        if (e.target === e.currentTarget && isExiting) setPhase("done");
      }}
      className="fixed inset-0 z-9999 flex items-center justify-center bg-bg"
    >
      {/* Centre stack */}
      <div
        style={{
          opacity: isEntered ? 1 : 0,
          transform: isEntered ? "translateY(0px)" : "translateY(16px)",
          transition:
            "opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1)",
        }}
        className="flex flex-col items-center gap-6 select-none"
      >
        {/* Logo with ambient glow */}
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden
            className="absolute rounded-2xl"
            style={{
              width: 72,
              height: 72,
              background: "var(--color-accent)",
              filter: "blur(28px)",
              opacity: 0.35,
            }}
          />
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            className="relative"
          >
            <rect width="24" height="24" rx="5.5" fill="var(--color-accent)" />
            <path
              d="M 6.5 5 L 6.5 19 M 6.5 5 L 13 5 Q 17 5 17 9 Q 17 13 13 13 L 6.5 13 M 11.5 13 L 17 19"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Name */}
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-text-primary">
          Readable
        </span>
      </div>
    </div>
  );
}
