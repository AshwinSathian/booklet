"use client";

import { useState } from "react";

export function EmbedButton({
  pageId,
  title,
  baseUrl,
}: {
  pageId: string;
  title: string;
  baseUrl: string;
}) {
  const [state, setState] = useState<"idle" | "copied">("idle");

  function copyEmbed() {
    const src = `${baseUrl}/p/${pageId}/embed`;
    const safeTitle = title.replace(/"/g, "&quot;");
    const code = `<iframe\n  src="${src}"\n  style="width:100%;min-height:400px;border:none;border-radius:8px;"\n  title="${safeTitle}"\n  loading="lazy"\n></iframe>`;

    if (typeof navigator !== "undefined" && "clipboard" in navigator) {
      void navigator.clipboard.writeText(code).then(() => {
        setState("copied");
        setTimeout(() => setState("idle"), 1800);
      });
    }
  }

  return (
    <button
      type="button"
      onClick={copyEmbed}
      title="Copy embed code"
      aria-label="Copy embed code"
      className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-muted transition hover:border-border-strong hover:text-text-primary"
    >
      {state === "copied" ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2 6l2.5 2.5 5.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden sm:inline">Embed</span>
        </>
      )}
    </button>
  );
}
