"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

export type ContextMenuPosition = { x: number; y: number };

type AnchorRect = { top: number; bottom: number; left: number; right: number; align: "start" | "end" };

/**
 * The app's one popup-menu primitive. Renders a small positioned (not
 * centered/modal) list of actions, either at an explicit point — right-click
 * — or anchored to a trigger element's edge via the `Menu` wrapper below.
 * Both paths share this same shell, so a right-click menu and a "..."
 * button's menu for the same object look and behave identically.
 *
 * Handles: viewport clamping, flip-to-open-upward when there isn't room
 * below an anchor, roving arrow-key navigation, initial focus on the first
 * item, and focus restoration to whatever was focused before it opened.
 */
export function ContextMenu({
  position,
  anchor,
  onClose,
  widthClass = "min-w-45",
  children,
}: {
  position?: ContextMenuPosition | null;
  anchor?: AnchorRect | null;
  onClose: () => void;
  widthClass?: string;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<{ top: number; left: number } | null>(null);
  const open = Boolean(position || anchor);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !menuRef.current) {
      setPlacement(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    let top: number;
    let left: number;

    if (anchor) {
      left = anchor.align === "end" ? anchor.right - rect.width : anchor.left;
      const spaceBelow = window.innerHeight - anchor.bottom;
      const openAbove = spaceBelow < rect.height + 14 && anchor.top > rect.height + 14;
      top = openAbove ? anchor.top - rect.height - 6 : anchor.bottom + 6;
    } else {
      left = position!.x;
      top = position!.y;
    }

    left = Math.min(Math.max(8, left), window.innerWidth - rect.width - 8);
    top = Math.min(Math.max(8, top), window.innerHeight - rect.height - 8);
    setPlacement({ top, left });
  }, [position, anchor, open]);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    });

    function items() {
      return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    }

    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      const list = items();
      if (list.length === 0) return;
      const currentIndex = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        list[(currentIndex + 1 + list.length) % list.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        list[(currentIndex - 1 + list.length) % list.length]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        list[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        list[list.length - 1]?.focus();
      }
    }
    function handleScroll(e: Event) {
      // Ignore scrolls inside the menu's own (possibly overflowing) body —
      // only an ancestor/page scroll invalidates the anchor position.
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
      restoreFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: "fixed",
        top: placement?.top ?? position?.y ?? anchor?.bottom ?? 0,
        left: placement?.left ?? position?.x ?? anchor?.left ?? 0,
        visibility: placement ? "visible" : "hidden",
      }}
      className={[
        "z-50 max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-lg border border-border-default bg-bg-elevated py-1 shadow-glass animate-dropdown-in",
        widthClass,
      ].join(" ")}
    >
      {children}
    </div>,
    document.body,
  );
}

/**
 * Trigger-anchored menu — wraps ContextMenu, computing its anchor rect from
 * `anchorRef` (the caller's already-rendered trigger element) each time it
 * opens. This is what turns a button click into the same positioned popup a
 * right-click produces.
 */
export function Menu({
  open,
  onClose,
  anchorRef,
  align = "end",
  widthClass,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  align?: "start" | "end";
  widthClass?: string;
  children: ReactNode;
}) {
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setAnchor(null);
      return;
    }
    const r = anchorRef.current.getBoundingClientRect();
    setAnchor({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, align });
  }, [open, align, anchorRef]);

  return (
    <ContextMenu anchor={anchor} onClose={onClose} widthClass={widthClass}>
      {children}
    </ContextMenu>
  );
}

export function ContextMenuItem({
  icon,
  label,
  description,
  onSelect,
  href,
  danger,
  disabled,
  active,
  activeLabel,
  locked,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  description?: string;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  activeLabel?: string;
  locked?: boolean;
}) {
  const cls = [
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition",
    disabled
      ? "text-text-muted opacity-40 pointer-events-none"
      : danger
        ? "text-red-400 hover:bg-red-400/8 focus-visible:bg-red-400/8"
        : active
          ? "text-accent bg-accent-dim hover:bg-accent-dim"
          : "text-text-secondary hover:bg-fill-2 hover:text-text-primary focus-visible:bg-fill-2 focus-visible:text-text-primary",
    "focus-visible:outline-none",
  ].join(" ");

  const iconCls = danger ? "text-red-400/70" : active ? "text-accent" : "text-text-muted";

  const inner = (
    <>
      <span className={["shrink-0", iconCls].join(" ")}>
        <Icon name={icon} size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block leading-tight">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-text-muted">{description}</span> : null}
      </span>
      {locked ? (
        <span className="shrink-0 rounded-pill border border-accent/40 bg-accent/10 px-2 py-0.5 text-2xs font-semibold text-accent">
          Pro
        </span>
      ) : active && activeLabel ? (
        <span className="shrink-0 text-xs font-medium text-accent">{activeLabel}</span>
      ) : null}
    </>
  );

  if (href) {
    const external = !locked;
    return (
      <a
        role="menuitem"
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        onClick={onSelect}
        className={cls}
      >
        {inner}
      </a>
    );
  }

  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onSelect} className={cls}>
      {inner}
    </button>
  );
}

export function ContextMenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-text-muted first:pt-1.5">
      {children}
    </div>
  );
}

export function ContextMenuSeparator() {
  return <div className="my-1 border-t border-border-subtle" />;
}
