"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Loading editor…",
  "Restoring drafts…",
  "Preparing workspace…",
  "Ready.",
];

const PROGRESS_START_MS = 320;
const PROGRESS_DURATION_MS = 1050;
const EXIT_MS = 1700;
const FADE_MS = 380;

type Phase = "pre" | "entering" | "running" | "exiting" | "done";

export function AppLoader() {
  const [phase, setPhase] = useState<Phase>("pre");
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => setPhase("entering"));
    });

    timers.push(setTimeout(() => setPhase("running"), PROGRESS_START_MS));

    // Cycle status messages evenly across the progress duration
    const msgStep = PROGRESS_DURATION_MS / (MESSAGES.length - 1);
    MESSAGES.slice(1).forEach((_, i) => {
      timers.push(
        setTimeout(
          () => setMsgIdx(i + 1),
          PROGRESS_START_MS + (i + 1) * msgStep,
        ),
      );
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

  const isEntered = phase === "entering" || phase === "running" || phase === "exiting";
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

        {/* Progress bar — CSS-transition-only, no rAF loop.
            Transition is always set so when width changes to 100% in "running"
            phase the browser can smoothly animate it without a race condition. */}
        <div
          className="overflow-hidden rounded-full"
          style={{
            width: 168,
            height: 2,
            background: "var(--color-border-subtle)",
          }}
        >
          <div
            style={{
              height: "100%",
              width: phase === "running" || phase === "exiting" ? "100%" : "0%",
              background: "var(--color-accent)",
              borderRadius: 9999,
              transition: `width ${PROGRESS_DURATION_MS}ms cubic-bezier(0.4,0,0.2,1)`,
            }}
          />
        </div>

        {/* Status message */}
        <span
          key={msgIdx}
          style={{ animation: "loaderMsgIn 0.22s ease both" }}
          className="h-4 text-[11px] font-mono tracking-wide text-text-muted"
        >
          {MESSAGES[msgIdx]}
        </span>
      </div>
    </div>
  );
}
