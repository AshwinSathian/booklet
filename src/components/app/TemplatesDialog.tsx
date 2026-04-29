"use client";

import { TEMPLATES, type Template } from "@/lib/templates";
import { useEffect, useRef } from "react";
import { Icon } from "../ui/Icon";

export function TemplatesDialog({
  visible,
  onHide,
  onSelect,
}: {
  visible: boolean;
  onHide: () => void;
  onSelect: (template: Template) => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onHide(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-40 flex items-center justify-center bg-bg/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onHide();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a template"
        className={[
          "relative w-full max-w-2xl max-h-[80vh] flex flex-col",
          "rounded-card border border-outline bg-bg-elevated shadow-glass",
          "animate-dialog-in",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-outline/60 shrink-0">
          <span className="text-sm font-semibold">Choose a template</span>
          <button
            type="button"
            onClick={onHide}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition hover:bg-outline/30 hover:text-text-primary"
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto flex-1 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => {
                  onSelect(t);
                  onHide();
                }}
                className="flex flex-col items-start gap-1 rounded-card border border-outline bg-bg-elevated px-4 py-3.5 text-left transition hover:border-accent-soft/40 hover:bg-accent/4 active:scale-[0.99]"
              >
                <span className="text-sm font-medium text-text-primary">{t.name}</span>
                <span className="text-xs text-text-muted leading-relaxed">{t.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
