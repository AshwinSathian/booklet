"use client";

import { InputTextarea } from "primereact/inputtextarea";
import { useEffect, useRef } from "react";

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

  const platform =
    typeof navigator !== "undefined" ? (navigator.platform ?? "") : "";
  const isMac = platform.toLowerCase().includes("mac");

  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden w-full">
      <div className="shrink-0 px-3 py-2 text-text-primary text-xs uppercase tracking-wide">
        {isMac ? "Cmd" : "Ctrl"}+K focuses this box.
      </div>

      <div className="flex-1 min-h-0 overflow-hidden w-full">
        <InputTextarea
          ref={ref as any}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoResize={false}
          placeholder="Paste anything that looks technical: an explanation, a checklist, logs, tables, code…"
          className="h-full w-full min-h-0 min-w-0 overflow-y-auto rounded-xl border border-outline p-3 text-xs leading-tight font-mono!"
        />
      </div>
    </div>
  );
}
