"use client";

import { useEffect, useRef, useState } from "react";

const MESSAGES = [
  "Loading editor…",
  "Restoring drafts…",
  "Preparing workspace…",
  "Ready.",
];

const ENTER_DELAY_MS = 80;    // wait one paint before entering
const PROGRESS_START_MS = 380; // when progress bar begins filling
const PROGRESS_DURATION_MS = 1050; // how long the bar takes to fill
const EXIT_MS = 1700;         // when fade-out starts
const FADE_MS = 380;          // fade-out duration

type Phase = "pre" | "entering" | "running" | "exiting" | "done";

export function AppLoader() {
  const [phase, setPhase] = useState<Phase>("pre");
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // One rAF to ensure initial "pre" renders, then trigger enter
    const r = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase("entering"));
    });

    // Begin progress bar
    timers.push(
      setTimeout(() => {
        setPhase("running");
        const startTime = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - startTime) / PROGRESS_DURATION_MS, 1);
          setProgress(p);
          if (p < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }, PROGRESS_START_MS),
    );

    // Message cycling — distribute across progress duration
    const msgStep = PROGRESS_DURATION_MS / (MESSAGES.length - 1);
    MESSAGES.slice(1).forEach((_, i) => {
      timers.push(
        setTimeout(
          () => setMsgIdx(i + 1),
          PROGRESS_START_MS + (i + 1) * msgStep,
        ),
      );
    });

    // Begin exit
    timers.push(setTimeout(() => setPhase("exiting"), EXIT_MS));

    return () => {
      cancelAnimationFrame(r);
      cancelAnimationFrame(rafRef.current);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === "done") return null;

  const isEntered = phase === "entering" || phase === "running" || phase === "exiting";

  return (
    <div
      aria-hidden
      style={{
        opacity: phase === "exiting" ? 0 : 1,
        transition:
          phase === "exiting"
            ? `opacity ${FADE_MS}ms ease-out`
            : undefined,
        pointerEvents: phase === "exiting" ? "none" : "all",
      }}
      onTransitionEnd={() => {
        if (phase === "exiting") setPhase("done");
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg"
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
        <span
          className="text-[15px] font-semibold tracking-[-0.01em] text-text-primary"
        >
          Readable
        </span>

        {/* Progress bar track */}
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
              width: `${Math.round(progress * 100)}%`,
              background: "var(--color-accent)",
              borderRadius: 9999,
              transition:
                phase === "running"
                  ? `width ${PROGRESS_DURATION_MS}ms cubic-bezier(0.4,0,0.2,1)`
                  : "none",
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
