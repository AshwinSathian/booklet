"use client";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { Button } from "@/components/ui/Button";
import type { Block, DocSettings } from "@/lib/blocks";
import { SAMPLE_MARKDOWN } from "@/lib/sample";
import type { WikilinkRenderCtx } from "@/lib/wikilinks/render-context";
import { useState } from "react";

export function PreviewPane({
  blocks,
  settings,
  isEmpty,
  isBusy,
  onInsertSample,
  wikilinkCtx,
  backlinksCount = 0,
  onOpenBacklinks,
  onOpenGraph,
}: {
  blocks: Block[];
  settings: DocSettings;
  isEmpty: boolean;
  isBusy: boolean;
  onInsertSample?: () => void;
  wikilinkCtx?: WikilinkRenderCtx;
  backlinksCount?: number;
  onOpenBacklinks?: () => void;
  onOpenGraph?: () => void;
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
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border-default bg-bg">
        <span className="text-xs font-medium text-text-muted">Preview</span>
        <div className="flex items-center gap-3">
          {onOpenBacklinks && (
            <button
              type="button"
              onClick={onOpenBacklinks}
              title="Linked mentions — drafts that reference this one via [[wikilinks]]"
              className="text-xs text-text-muted transition hover:text-text-primary"
            >
              {backlinksCount > 0 ? `${backlinksCount} linked mention${backlinksCount === 1 ? "" : "s"}` : "Backlinks"}
            </button>
          )}
          {onOpenGraph && (
            <button
              type="button"
              onClick={onOpenGraph}
              title="Graph — private visualization of your linked drafts"
              className="text-xs text-text-muted transition hover:text-text-primary"
            >
              Graph
            </button>
          )}
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success/70 animate-dot-pulse" aria-hidden />
            Live
          </span>
        </div>
      </div>

      {/* Preview surface: paper, as the published page is */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-bg">
        {isBusy ? (
          <div className="flex h-full items-start p-4 animate-fade-in">
            <span className="flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.16em] text-text-muted">
              <span className="h-1 w-12 rounded-full bg-text-muted/20 animate-shimmer bg-linear-to-r from-transparent via-text-muted/15 to-transparent bg-size-[200%_100%]" aria-hidden />
              Updating
            </span>
          </div>
        ) : isEmpty ? (
          <EmptyState onInsertSample={onInsertSample} onCopySample={onCopySample} copyState={copyState} />
        ) : (
          <div className="h-full w-full overflow-y-auto px-4 py-5">
            <BlockRenderer blocks={blocks} settings={settings} wikilinkCtx={wikilinkCtx} />
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
        <div className="font-display text-xl font-medium">Write. Preview. Publish.</div>
        <div className="mt-2 text-sm leading-[1.7] text-text-secondary">
          Type or paste Markdown <span className="lg:hidden">in the Write tab</span>
          <span className="max-lg:hidden">on the left</span>. Your formatted page appears here live.
        </div>

        {/* Sample Markdown teaser */}
        <div className="mt-5 rounded-xl border border-border-default bg-bg-elevated text-left overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
            <span className="text-2xs font-semibold uppercase tracking-[0.16em] text-text-muted">
              Sample
            </span>
            <div className="flex items-center gap-1">
              {onInsertSample ? (
                <Button variant="secondary" size="sm" onClick={onInsertSample} title="Insert sample">
                  Insert
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                onClick={onCopySample}
                title="Copy sample"
                className={copyState === "failed" ? "border-danger/40 text-danger" : ""}
              >
                {copyState === "copied" ? "Copied!" : copyState === "failed" ? "Failed" : "Copy"}
              </Button>
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
          <kbd className="rounded border border-border-default bg-fill-2 px-1 py-0.5 font-mono text-2xs">J</kbd>
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
