"use client";

import { useState } from "react";

/** Copies `text`. Always visible and reachable by keyboard; says "Copied" to screen readers. */
export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // The clipboard is unavailable (insecure context, denied permission): the text is still selectable.
        }
      }}
      className={`rounded-md border border-border-strong bg-bg-elevated px-2.5 py-1 text-xs font-medium text-text-primary hover:border-accent ${className}`}
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
