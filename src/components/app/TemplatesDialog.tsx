"use client";

import { TEMPLATES, type Template } from "@/lib/templates";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";

// Minimal markdown → readable preview (no external dep, handles headings/lists/bold)
function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  function flushList() {
    if (!listBuffer.length) return;
    elements.push(
      <ul key={key++} className="ml-4 list-disc space-y-0.5 mb-2">
        {listBuffer.map((item, i) => (
          <li key={i} className="text-xs text-text-secondary leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    );
    listBuffer = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trimStart();

    // headings
    const hm = /^(#{1,6})\s+(.+)$/.exec(stripped);
    if (hm) {
      flushList();
      const level = hm[1].length;
      const text = hm[2];
      const cls =
        level === 1
          ? "text-sm font-bold text-text-primary mt-3 mb-1"
          : level === 2
            ? "text-xs font-semibold text-text-primary mt-2.5 mb-0.5"
            : "text-xs font-medium text-text-secondary mt-2 mb-0.5";
      elements.push(<p key={key++} className={cls}>{text}</p>);
      continue;
    }

    // list items
    if (/^[-*+]\s/.test(stripped)) {
      listBuffer.push(stripped.slice(2));
      continue;
    }

    // numbered list
    if (/^\d+\.\s/.test(stripped)) {
      listBuffer.push(stripped.replace(/^\d+\.\s/, ""));
      continue;
    }

    flushList();

    // horizontal rule
    if (/^---+$/.test(stripped)) {
      elements.push(<hr key={key++} className="border-t border-border-subtle my-2" />);
      continue;
    }

    // blank line
    if (!stripped) {
      elements.push(<div key={key++} className="h-1" />);
      continue;
    }

    // plain text / inline
    elements.push(
      <p key={key++} className="text-xs text-text-secondary leading-relaxed">
        {stripped.replace(/\*\*(.+?)\*\*/g, "**$1**")}
      </p>
    );
  }

  flushList();
  return <>{elements}</>;
}

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
  const [selected, setSelected] = useState<Template>(TEMPLATES[0]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onHide(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, onHide]);

  // Reset selection when dialog opens
  useEffect(() => {
    if (visible) setSelected(TEMPLATES[0]);
  }, [visible]);

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
          "relative w-full max-w-3xl max-h-[85vh] flex flex-col",
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

        {/* Body: two-panel */}
        <div className="flex flex-1 min-h-0">
          {/* Left: template list */}
          <div className="w-56 shrink-0 border-r border-outline/60 overflow-y-auto flex flex-col">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setSelected(t)}
                className={[
                  "flex flex-col items-start gap-0.5 px-3 py-2.5 text-left transition border-b border-outline/30 last:border-b-0 w-full",
                  selected.name === t.name
                    ? "bg-accent/8 text-accent"
                    : "text-text-secondary hover:bg-fill-2 hover:text-text-primary",
                ].join(" ")}
              >
                <span className="text-xs font-medium leading-snug">{t.name}</span>
                {t.category && (
                  <span className="text-2xs text-text-muted/70">{t.category}</span>
                )}
              </button>
            ))}
          </div>

          {/* Right: preview */}
          <div className="flex flex-1 flex-col min-w-0 min-h-0">
            {/* Preview header */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-outline/40 shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">{selected.name}</p>
                <p className="text-xs text-text-muted truncate mt-0.5">{selected.description}</p>
              </div>
              <button
                type="button"
                onClick={() => { onSelect(selected); onHide(); }}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-pill bg-accent px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover active:scale-[0.97]"
              >
                Use template
                <svg width="9" height="9" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* Scrollable preview content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <MarkdownPreview content={selected.content} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
