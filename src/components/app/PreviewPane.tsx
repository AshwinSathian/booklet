"use client";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { Block, DocSettings } from "@/lib/blocks";
import { SAMPLE_MARKDOWN } from "@/lib/sample";
import { Button } from "primereact/button";
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
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

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
      <div className="shrink-0 px-3 py-2 text-text-primary text-xs uppercase tracking-wide">
        This is a preview. Publish to make this public and accessible by link.
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-sm border border-outline bg-bg-glass p-3">
        {isBusy ? (
          <div className="text-xs text-[rgb(var(--muted))] uppercase tracking-widest">
            Updating…
          </div>
        ) : isEmpty ? (
          <div className="flex h-full w-full items-center justify-center px-6 py-4 text-center text-sm text-[rgb(var(--muted))]">
            <div className="max-w-lg">
              <div className="uppercase tracking-wide">
                <div className="text-lg font-semibold mb-2 text-text-primary">
                  Paste. Preview. Publish. Share.
                </div>
                <div className="leading-6">
                  Paste Markdown on the left. Preview on the right. Publish for
                  a link.
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-outline bg-bg-soft text-left p-3">
                <div className="w-full flex items-center justify-between gap-2">
                  <div className="text-md uppercase tracking-widest text-[rgb(var(--muted))]">
                    Sample
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      icon="pi pi-file-import"
                      size="small"
                      onClick={onInsertSample}
                      severity="secondary"
                      text
                      raised
                      className="text-xs uppercase tracking-widest p-1"
                      disabled={!onInsertSample}
                    />
                    <Button
                      icon="pi pi-copy"
                      size="small"
                      onClick={onCopySample}
                      severity={copyState === "failed" ? "danger" : "secondary"}
                      text
                      raised
                      className="text-xs uppercase tracking-widest p-1"
                    />
                  </div>
                </div>

                <pre className="mt-3 text-xs leading-5 font-mono whitespace-pre-wrap">
                  {SAMPLE_MARKDOWN.slice(0, 260)}…
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full w-full overflow-y-auto px-3 py-2">
            <BlockRenderer blocks={blocks} settings={settings} />
          </div>
        )}
      </div>
    </div>
  );
}
