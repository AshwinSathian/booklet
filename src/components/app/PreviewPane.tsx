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
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-outline/50">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Preview
        </span>
        <span className="text-[10px] text-text-muted">
          Live · ⌘↵ to publish
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-bg-soft/40 border-l border-outline/30">
        {isBusy ? (
          <div className="flex h-full items-start p-4">
            <span className="text-[10px] font-medium uppercase tracking-widest text-text-muted animate-pulse">
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
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-2xl">
            📄
          </div>
        </div>
        <div className="text-[15px] font-semibold tracking-tight">
          Paste. Preview. Publish.
        </div>
        <div className="mt-2 text-[13px] leading-[1.7] text-text-secondary">
          Type or paste Markdown on the left. Your formatted preview appears here live.
        </div>

        {/* Sample Markdown teaser */}
        <div className="mt-5 rounded-xl border border-outline bg-bg-elevated text-left overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-outline">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              Sample
            </span>
            <div className="flex items-center gap-1">
              {onInsertSample ? (
                <button
                  type="button"
                  onClick={onInsertSample}
                  title="Insert sample"
                  className="rounded-md px-2 py-1 text-[10px] font-medium text-text-muted transition hover:bg-outline/30 hover:text-text-primary"
                >
                  Insert
                </button>
              ) : null}
              <button
                type="button"
                onClick={onCopySample}
                title="Copy sample"
                className={[
                  "rounded-md px-2 py-1 text-[10px] font-medium transition",
                  copyState === "copied"
                    ? "text-emerald-400"
                    : copyState === "failed"
                      ? "text-red-400"
                      : "text-text-muted hover:bg-outline/30 hover:text-text-primary",
                ].join(" ")}
              >
                {copyState === "copied" ? "Copied!" : copyState === "failed" ? "Failed" : "Copy"}
              </button>
            </div>
          </div>
          <pre className="p-3 font-mono text-[11px] leading-[1.65] text-text-secondary whitespace-pre-wrap">
            {SAMPLE_MARKDOWN.slice(0, 260)}…
          </pre>
        </div>

        {/* Keyboard hint */}
        <div className="mt-4 text-[11px] text-text-muted">
          <kbd className="rounded border border-outline bg-bg-elevated px-1 py-0.5 font-mono text-[9px]">⌘</kbd>
          {" + "}
          <kbd className="rounded border border-outline bg-bg-elevated px-1 py-0.5 font-mono text-[9px]">K</kbd>
          {" "}to focus editor ·{" "}
          <kbd className="rounded border border-outline bg-bg-elevated px-1 py-0.5 font-mono text-[9px]">⌘</kbd>
          {" + "}
          <kbd className="rounded border border-outline bg-bg-elevated px-1 py-0.5 font-mono text-[9px]">↵</kbd>
          {" "}to publish
        </div>
      </div>
    </div>
  );
}
