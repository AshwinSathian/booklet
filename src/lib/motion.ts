/**
 * Shared motion primitives for the Precision identity. One easing curve and
 * a small fixed set of durations, so every animated component feels like one
 * system instead of per-component guesses — mirrors the CSS-side
 * --duration-* and --ease-spring tokens in globals.css; this is the JS-side
 * equivalent for framer-motion consumers, which can't read CSS custom
 * properties directly into transition configs.
 */

import { useEffect, useState } from "react";

/** Linear-style "snappy decelerate" — the one curve used everywhere. */
export const EASE_PRECISION = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  fast: 0.12,
  normal: 0.18,
  slow: 0.24,
} as const;

/** SSR-safe: starts false, syncs to the real media query after mount. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}

/**
 * Runs an in-app navigation inside the native View Transitions API when the
 * browser supports it and the user hasn't asked for reduced motion,
 * otherwise falls back to a plain navigation. Deliberately uses the
 * standard `document.startViewTransition` web-platform API directly rather
 * than a Next.js-version-specific experimental config flag, so it doesn't
 * depend on unstable framework internals — `navigate` is whatever
 * navigation function the caller already has (e.g. a `next/navigation`
 * router's `.push`).
 */
export function navigateWithViewTransition(navigate: () => void, prefersReducedMotion: boolean): void {
  if (prefersReducedMotion || typeof document === "undefined" || !("startViewTransition" in document)) {
    navigate();
    return;
  }
  (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(navigate);
}
