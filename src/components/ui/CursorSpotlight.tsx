"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

/**
 * A low-opacity radial-gradient glow that tracks the pointer within its
 * nearest `relative`-positioned ancestor. Meant for dark hero/marketing
 * sections only — this is Precision's one static-mode "glow," reserved for
 * a handful of signature moments (hero, final CTA), not general chrome.
 * Renders nothing (skips the mousemove listener entirely) under
 * prefers-reduced-motion.
 */
export function CursorSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;

    const parent = el.parentElement;
    if (!parent) return;

    function handleMove(e: PointerEvent) {
      const rect = parent!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el!.style.background = `radial-gradient(600px circle at ${x}px ${y}px, var(--color-accent-dim), transparent 70%)`;
    }

    parent.addEventListener("pointermove", handleMove);
    return () => parent.removeEventListener("pointermove", handleMove);
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
    />
  );
}
