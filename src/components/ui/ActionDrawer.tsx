"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

export function ActionDrawer({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const activeElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (activeElement instanceof HTMLElement) activeElement.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 print:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close drawer"
      />

      <aside
        className={[
          "absolute border-border-default bg-bg shadow-glass animate-dialog-in",
          "inset-x-0 bottom-0 max-h-[86dvh] overflow-hidden rounded-t-card border-t",
          "sm:inset-y-0 sm:left-auto sm:right-0 sm:h-dvh sm:max-h-none sm:w-[380px] sm:rounded-none sm:border-l sm:border-t-0",
        ].join(" ")}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
              {description ? (
                <p className="mt-1 text-xs leading-[1.5] text-text-muted">{description}</p>
              ) : null}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition hover:bg-fill-2 hover:text-text-primary"
              aria-label="Close drawer"
            >
              <Icon name="close" size={14} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {children}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function DrawerSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="py-2">
      {title ? (
        <div className="px-2 pb-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
          {title}
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border-subtle bg-bg-elevated">
        {children}
      </div>
    </section>
  );
}
