import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * False on the server and while React hydrates, true from then on.
 *
 * For values only the browser knows (its time zone, what it supports, the
 * theme it stored): render the server's answer first so the HTML matches,
 * then the browser's. A store that never changes, read two ways, does this
 * without a state update in an effect.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}
