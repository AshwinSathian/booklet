/**
 * Shared motion primitives. One easing curve and
 * a small fixed set of durations, so every animated component feels like one
 * system instead of per-component guesses — mirrors the CSS-side
 * --duration-* and --ease-spring tokens in globals.css; this is the JS-side
 * equivalent for framer-motion consumers, which can't read CSS custom
 * properties directly into transition configs.
 */

import { useSyncExternalStore } from "react";

/** Linear-style "snappy decelerate" — the one curve used everywhere. */
export const EASE_PRECISION = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  fast: 0.12,
  normal: 0.18,
  slow: 0.24,
} as const;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** SSR-safe: false on the server and during hydration, then the real media query, live. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
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
