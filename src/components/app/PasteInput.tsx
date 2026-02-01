"use client";

import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { useEffect, useMemo, useRef } from "react";

export function PasteInput({
  value,
  onChange,
  onFocusShortcutRequested,
  onInsertSample,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocusShortcutRequested?: (focusFn: () => void) => void;
  onInsertSample?: () => void;
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

  const isEmpty = useMemo(() => !value.trim(), [value]);

  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden w-full">
      <div className="shrink-0 px-3 py-2 flex items-center justify-between gap-3">
        <div className="text-text-primary text-xs uppercase tracking-wide">
          {isMac ? "Cmd" : "Ctrl"}+K focuses this box.
        </div>

        {isEmpty ? (
          <Button
            label="Insert sample"
            icon="pi pi-file-import"
            size="small"
            onClick={onInsertSample}
            severity="secondary"
            text
            raised
            className="text-xs uppercase tracking-widest"
            disabled={!onInsertSample}
          />
        ) : null}
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
