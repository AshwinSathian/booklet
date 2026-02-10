"use client";

import { InputTextarea } from "primereact/inputtextarea";
import type { Ref } from "react";
import { useEffect, useRef } from "react";

const LABELS = {
  shortcutHint: "Cmd/Ctrl+K focuses this box.",
  emptyHint: "Start writing… Autosave keeps your draft safe.",
  placeholder:
    "Paste anything that looks technical: an explanation, a checklist, logs, tables, code…",
} as const;

export function PasteInput({
  value,
  onChange,
  onFocusShortcutRequested,
  showEmptyHint,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocusShortcutRequested?: (focusFn: () => void) => void;
  showEmptyHint?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (onFocusShortcutRequested) {
      onFocusShortcutRequested(() => ref.current?.focus());
    }
  }, [onFocusShortcutRequested]);

  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden w-full">
      <div className="shrink-0 px-3 py-2 flex flex-col gap-1">
        <div className="hidden md:block text-text-primary text-xs uppercase tracking-wide">
          {LABELS.shortcutHint}
        </div>
        {showEmptyHint && !value.trim() ? (
          <div className="text-xs text-[rgb(var(--muted))]">
            {LABELS.emptyHint}
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden w-full">
        <InputTextarea
          ref={ref as unknown as Ref<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoResize={false}
          placeholder={LABELS.placeholder}
          className="h-full w-full min-h-0 min-w-0 overflow-y-auto rounded-xl border border-outline p-3 text-xs leading-tight font-mono!"
        />
      </div>
    </div>
  );
}
