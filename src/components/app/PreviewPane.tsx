"use client";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { Block, DocSettings } from "@/lib/blocks";
import { SAMPLE_MARKDOWN } from "@/lib/sample";
import { useState } from "react";

export function PreviewPane({
  blocks,
  settings,
  isEmpty,
  isBusy,
  onInsertSample,
}: {
  blocks: Block[];
  settings: DocSettings;
  isEmpty: boolean;
  isBusy: boolean;
  onInsertSample?: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function onCopySample() {
    try {
      await navigator.clipboard.writeText(SAMPLE_MARKDOWN);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("failed");
      setTimeout(() => setCopyState("idle"), 1400);
    }
  }

  return (
    <div className="flex h-full max-h-full min-h-0 flex-col w-full overflow-hidden">
      {/* Pane label */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border-subtle bg-bg-soft/50">
        <span className="text-2xs font-medium text-text-muted/60 tracking-wide">Preview</span>
        <span className="flex items-center gap-1 text-2xs text-text-muted/40">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500/70" aria-hidden />
          Live
        </span>
      </div>

      {/* Preview surface — bg-bg-soft differentiates it from the editor pane */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-bg-soft border-l border-border-subtle">
        {isBusy ? (
          <div className="flex h-full items-start p-4">
            <span className="text-2xs font-medium uppercase tracking-widest text-text-muted animate-pulse">
              Updating…
            </span>
          </div>
        ) : isEmpty ? (
          <EmptyState onInsertSample={onInsertSample} onCopySample={onCopySample} copyState={copyState} />
        ) : (
          <div className="h-full w-full overflow-y-auto px-4 py-5">
            <BlockRenderer blocks={blocks} settings={settings} />
          </div>
        )}
      </div>
    </div>
  );
}

function PageIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EmptyState({
  onInsertSample,
  onCopySample,
  copyState,
}: {
  onInsertSample?: () => void;
  onCopySample: () => void;
  copyState: "idle" | "copied" | "failed";
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-card bg-accent-dim text-accent-soft">
            <PageIcon />
          </div>
        </div>
        <div className="text-[15px] font-semibold tracking-tight">
          Write. Preview. Publish.
        </div>
        <div className="mt-2 text-sm leading-[1.7] text-text-secondary">
          Type or paste Markdown on the left. Your formatted page appears here live.
        </div>

        {/* Sample Markdown teaser */}
        <div className="mt-5 rounded-xl border border-border-default bg-bg-elevated text-left overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
            <span className="text-2xs font-semibold uppercase tracking-widest text-text-muted">
              Sample
            </span>
            <div className="flex items-center gap-1">
              {onInsertSample ? (
                <button
                  type="button"
                  onClick={onInsertSample}
                  title="Insert sample"
                  className="rounded-md px-2 py-1 text-2xs font-medium text-text-muted transition hover:bg-fill-2 hover:text-text-primary"
                >
                  Insert
                </button>
              ) : null}
              <button
                type="button"
                onClick={onCopySample}
                title="Copy sample"
                className={[
                  "rounded-md px-2 py-1 text-2xs font-medium transition",
                  copyState === "copied"
                    ? "text-emerald-400"
                    : copyState === "failed"
                      ? "text-red-400"
                      : "text-text-muted hover:bg-fill-2 hover:text-text-primary",
                ].join(" ")}
              >
                {copyState === "copied" ? "Copied!" : copyState === "failed" ? "Failed" : "Copy"}
              </button>
            </div>
          </div>
          {/* Fade out the bottom of the sample preview */}
          <div className="relative">
            <pre className="p-3 font-mono text-xs leading-[1.65] text-text-secondary whitespace-pre-wrap">
              {SAMPLE_MARKDOWN.slice(0, 260)}
            </pre>
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-linear-to-t from-bg-elevated to-transparent pointer-events-none" />
          </div>
        </div>

        {/* Keyboard hint */}
        <div className="mt-4 text-xs text-text-muted">
          <kbd className="rounded border border-border-default bg-fill-2 px-1 py-0.5 font-mono text-2xs">⌘</kbd>
          {" + "}
          <kbd className="rounded border border-border-default bg-fill-2 px-1 py-0.5 font-mono text-2xs">K</kbd>
          {" "}to focus editor ·{" "}
          <kbd className="rounded border border-border-default bg-fill-2 px-1 py-0.5 font-mono text-2xs">⌘</kbd>
          {" + "}
          <kbd className="rounded border border-border-default bg-fill-2 px-1 py-0.5 font-mono text-2xs">↵</kbd>
          {" "}to publish
        </div>
      </div>
    </div>
  );
}
