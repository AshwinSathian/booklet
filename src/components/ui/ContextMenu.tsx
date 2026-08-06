"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export type ContextMenuPosition = { x: number; y: number };

/**
 * A small positioned (not centered/modal) menu, opened at the cursor on
 * right-click. This is the app's first non-modal overlay primitive — every
 * existing overlay (ActionDrawer) is a centered dialog / bottom sheet.
 * Deliberately not reused for touch: there's no right-click equivalent, so
 * touch devices fall back to the existing "..." button + ActionDrawer
 * instead of simulating long-press.
 */
export function ContextMenu({
  position,
  onClose,
  children,
}: {
  position: ContextMenuPosition | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!position || !menuRef.current) {
      setPlacement(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const left = Math.min(position.x, Math.max(8, window.innerWidth - rect.width - 8));
    const top = Math.min(position.y, Math.max(8, window.innerHeight - rect.height - 8));
    setPlacement({ left, top });
  }, [position]);

  useEffect(() => {
    if (!position) return;
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleScroll() {
      onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [position, onClose]);

  if (!position) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: "fixed",
        top: placement?.top ?? position.y,
        left: placement?.left ?? position.x,
        visibility: placement ? "visible" : "hidden",
      }}
      className="z-50 min-w-45 overflow-hidden rounded-lg border border-border-default bg-bg-elevated py-1 shadow-glass"
    >
      {children}
    </div>,
    document.body,
  );
}

export function ContextMenuItem({
  icon,
  label,
  onSelect,
  danger,
  disabled,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={[
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition",
        disabled
          ? "text-text-muted opacity-40 pointer-events-none"
          : danger
            ? "text-red-400 hover:bg-red-400/8"
            : "text-text-secondary hover:bg-fill-2 hover:text-text-primary",
      ].join(" ")}
    >
      <span className={danger ? "text-red-400/70" : "text-text-muted"}>
        <Icon name={icon} size={14} />
      </span>
      {label}
    </button>
  );
}

export function ContextMenuSeparator() {
  return <div className="my-1 border-t border-border-subtle" />;
}
