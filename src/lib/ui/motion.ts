/** Shared check for `prefers-reduced-motion: reduce` — used to skip
 * decorative-only transitions (brand flashes, reveal animations) for users
 * who've asked the OS not to show them. Not for functional motion. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
