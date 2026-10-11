"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A centred modal for one short task: a form with a few fields, or a
 * confirmation. It is a native <dialog>, so the focus trap, Escape and the
 * backdrop come with it, and it sits in the top layer, clear of any
 * ancestor's stacking or containing block. A click on the backdrop closes it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // The dialog element covers only its own box; a click that lands on the element itself is on the backdrop.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={titleId}
      // m-auto: the reset takes a dialog's own centring margin away.
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-border-default bg-bg-elevated p-0 text-text-primary shadow-glass backdrop:bg-black/45"
    >
      {/* The padding is on this box, so the dialog element has no area of its own to click. */}
      <div className="flex flex-col gap-4 p-6">
        <div>
          <h2 id={titleId} className="font-display text-xl font-medium tracking-[-0.01em]">{title}</h2>
          {description ? <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{description}</p> : null}
        </div>
        {/* Unmounted while closed, so a form starts empty each time it opens. */}
        {open ? children : null}
      </div>
    </dialog>
  );
}
