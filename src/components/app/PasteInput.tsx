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
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <span className="text-2xs font-semibold uppercase tracking-widest text-text-muted">
          Editor
        </span>
        <span className="text-2xs text-text-muted">
          <kbd className="rounded border border-border-default bg-fill-2 px-1 py-0.5 font-mono text-2xs">⌘K</kbd>
          {" "}focus
        </span>
      </div>

      {/* Textarea — bg-bg creates contrast against the preview pane's bg-bg-soft */}
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
            "font-mono text-sm leading-[1.65]",
            "p-4",
            "placeholder:text-text-muted/60",
            "focus:outline-none",
            "caret-accent",
          ].join(" ")}
        />
      </div>

      {/* Footer: word/char count */}
      <div className="shrink-0 flex items-center gap-1.5 border-t border-border-subtle px-3 py-1.5">
        <span className="text-2xs text-text-muted">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
        <span className="text-2xs text-text-muted opacity-40">·</span>
        <span className="text-2xs text-text-muted">{charCount} chars</span>
      </div>
    </div>
  );
}
