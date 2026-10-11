import type { KeyboardEvent } from "react";

/**
 * Arrow, Home and End keys for a `role="tablist"` whose tabs select on
 * focus: put this on the tablist element. Moves focus to the neighbouring
 * tab and clicks it. Pair it with `tabIndex={selected ? 0 : -1}` on each tab.
 */
export function onTablistKeyDown(e: KeyboardEvent<HTMLElement>) {
  const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
  const at = tabs.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  const to =
    e.key === "ArrowRight" || e.key === "ArrowDown"
      ? (at + 1) % tabs.length
      : e.key === "ArrowLeft" || e.key === "ArrowUp"
        ? (at - 1 + tabs.length) % tabs.length
        : e.key === "Home"
          ? 0
          : e.key === "End"
            ? tabs.length - 1
            : -1;
  if (to < 0) return;
  e.preventDefault();
  tabs[to].focus();
  tabs[to].click();
}
