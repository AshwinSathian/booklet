"use client";

import React, { useEffect, useRef, useState } from "react";

type MobilePane = "edit" | "preview";

const PEN_ICON = (
  <svg width="13" height="13" fill="none" viewBox="0 0 16 16" aria-hidden>
    <path d="M12.5 2.5a1.77 1.77 0 0 1 2.5 2.5L5.5 14.5l-4 1 1-4L12.5 2.5z"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EYE_ICON = (
  <svg width="13" height="13" fill="none" viewBox="0 0 16 16" aria-hidden>
    <path d="M1 8s2.667-5.333 7-5.333S15 8 15 8s-2.667 5.333-7 5.333S1 8 1 8z"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export function AppShell({
  left,
  right,
  focusMode = false,
  isEmpty = false,
  isReady = true,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  focusMode?: boolean;
  /** True once the active draft's content is known to be empty. Used only to
   * choose the initial mobile tab — never fights a manual tab switch afterward. */
  isEmpty?: boolean;
  /** True once the draft has hydrated and `isEmpty` reflects real content
   * (rather than the transient blank state before hydration runs). */
  isReady?: boolean;
}) {
  const [pane, setPane] = useState<MobilePane>("edit");
  const didSetDefaultPaneRef = useRef(false);

  // Choose the first-run mobile tab once, right after hydration tells us
  // whether the draft actually has content. A brand-new/empty draft opens on
  // Preview (onboarding/sample content); any existing draft keeps opening on
  // Write, matching prior behavior. Purely a one-time default — doesn't
  // override a tab the visitor picks afterward.
  useEffect(() => {
    if (!isReady || didSetDefaultPaneRef.current) return;
    didSetDefaultPaneRef.current = true;
    if (isEmpty) setPane("preview");
  }, [isReady, isEmpty]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
      {/* ── Mobile tab bar ── */}
      <div className="shrink-0 lg:hidden border-b border-border-subtle bg-bg-soft">
        <div className="flex">
          {([
            { id: "edit",    label: "Write",   icon: PEN_ICON },
            { id: "preview", label: "Preview", icon: EYE_ICON },
          ] as const).map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pane === id}
              onClick={() => setPane(id)}
              className={[
                "relative flex flex-1 items-center justify-center gap-1.5 py-2.5",
                "text-xs font-semibold transition-colors duration-fast",
                pane === id
                  ? "text-accent"
                  : "text-text-muted hover:text-text-secondary",
              ].join(" ")}
            >
              {icon}
              {label}
              {/* Active underline indicator */}
              {pane === id && (
                <span
                  aria-hidden
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full"
                  style={{ animation: "fadeIn 0.15s ease both" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Panes ── */}
      {/* Desktop: side-by-side with divider */}
      {/* Mobile: show active pane full-width */}
      <div
        className={[
          "flex min-h-0 overflow-hidden w-full",
          focusMode ? "lg:flex-1 lg:flex lg:flex-col" : "lg:max-w-[50%] lg:flex lg:flex-col",
          pane === "edit" ? "flex-1 animate-pane-in" : "hidden lg:flex",
        ].join(" ")}
      >
        {left}
      </div>

      {/* Vertical divider — desktop only, hidden in focus mode */}
      {!focusMode && <div aria-hidden className="hidden lg:block w-px shrink-0 bg-border-subtle" />}

      <div
        className={[
          "flex min-h-0 overflow-hidden w-full",
          focusMode
            ? "hidden"
            : [
                "lg:flex-1 lg:flex lg:flex-col",
                pane === "preview" ? "flex-1 animate-pane-in" : "hidden lg:flex",
              ].join(" "),
        ].join(" ")}
      >
        {right}
      </div>
    </div>
  );
}
