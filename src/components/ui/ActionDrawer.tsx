"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

const DRAWER_EXIT_MS = 160;

export function ActionDrawer({
  open,
  title,
  description,
  contentWidthClass = "max-w-7xl",
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  contentWidthClass?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const closeTimerRef = useRef<number | null>(null);
  const [shouldRender, setShouldRender] = useState(open);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setShouldRender(true);
      setIsClosing(false);
      return;
    }

    if (!shouldRender) return;

    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
      closeTimerRef.current = null;
    }, DRAWER_EXIT_MS);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;
    const activeElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (activeElement instanceof HTMLElement) activeElement.focus();
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 print:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={[
          "fixed inset-0 z-0 bg-black/50 backdrop-blur-sm",
          isClosing ? "animate-drawer-backdrop-out" : "animate-drawer-backdrop-in",
        ].join(" ")}
        onPointerDown={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center px-4">
        <aside
          className={[
            "flex max-h-[86dvh] w-full flex-col overflow-hidden rounded-t-card border border-b-0 border-border-default bg-bg shadow-glass",
            contentWidthClass,
            "[--drawer-enter-from:translate3d(0,24px,0)] [--drawer-exit-to:translate3d(0,24px,0)]",
            isClosing ? "animate-drawer-panel-out" : "animate-drawer-panel-in",
          ].join(" ")}
        >
          <div className="flex min-h-0 flex-1 flex-col">
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
    </div>,
    document.body,
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
