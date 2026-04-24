"use client";

import { useEffect, useMemo, useRef } from "react";

export function PasteInput({
  value,
  onChange,
  onFocusShortcutRequested,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocusShortcutRequested?: (focusFn: () => void) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (onFocusShortcutRequested) {
      onFocusShortcutRequested(() => ref.current?.focus());
    }
  }, [onFocusShortcutRequested]);

  const wordCount = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [value]);

  const charCount = value.length;

  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden w-full">
      {/* Pane label */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-outline/50">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Editor
        </span>
        <span className="text-[10px] text-text-muted">
          <kbd className="rounded border border-outline bg-bg-elevated px-1 py-0.5 font-mono text-[9px]">⌘K</kbd>
          {" "}focus
        </span>
      </div>

      {/* Textarea */}
      <div className="flex-1 min-h-0 overflow-hidden w-full">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste anything Markdown-shaped: notes, READMEs, incident summaries, tables, code…"
          spellCheck={false}
          className={[
            "h-full w-full min-h-0 min-w-0",
            "resize-none overflow-y-auto",
            "bg-bg text-text-primary",
            "font-mono text-[13px] leading-[1.65]",
            "p-3 pt-4",
            "placeholder:text-text-muted/50",
            "focus:outline-none",
            "caret-accent",
          ].join(" ")}
        />
      </div>

      {/* Footer: word/char count */}
      <div className="shrink-0 flex items-center gap-3 border-t border-outline/50 px-3 py-1.5">
        <span className="text-[10px] text-text-muted">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <span className="text-[10px] text-text-muted">{charCount} chars</span>
      </div>
    </div>
  );
}
