"use client";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { Block, DocSettings } from "@/lib/blocks";
import { Button } from "primereact/button";
import { useMemo, useState } from "react";

const SAMPLE = `# Example: A clear incident update

**What happened**
- Deploy completed at 10:42
- Error rate spiked from 0.2% to 4.8% within 2 minutes

**Impact**
- ~12% of users saw 500s
- Duration: 9 minutes

**Root cause**
A config flag enabled a slow code path for all requests.

\`\`\`ts
export function isEnabled(flag: string) {
  return process.env[flag] === "true";
}
\`\`\`

**Fix**
- Rolled back the flag
- Added a guardrail + alert on rollout
`;

export function PreviewPane({
  blocks,
  settings,
  isEmpty,
  isBusy,
}: {
  blocks: Block[];
  settings: DocSettings;
  isEmpty: boolean;
  isBusy: boolean;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const copyLabel = useMemo(() => {
    if (copyState === "copied") return "Copied";
    if (copyState === "failed") return "Copy failed";
    return "Copy sample";
  }, [copyState]);

  async function onCopySample() {
    try {
      await navigator.clipboard.writeText(SAMPLE);
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
            <div className="max-w-130">
              <div className="uppercase tracking-wide">
                <div className="text-lg font-semibold mb-2 text-text-primary">
                  A clean shareable page, instantly.
                </div>
                <div className="leading-6">
                  Paste content on the left. We’ll format it into a page that’s
                  easy to read and easy to share.
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-outline bg-bg-soft text-left p-3">
                <div className="w-full flex items-center justify-between">
                  <div className="text-md uppercase tracking-widest text-[rgb(var(--muted))] mb-2">
                    Sample you can try
                  </div>

                  <Button
                    label={copyLabel}
                    icon="pi pi-copy"
                    size="small"
                    onClick={onCopySample}
                    severity={copyState === "failed" ? "danger" : "secondary"}
                    text
                    raised
                    className="text-xs uppercase tracking-widest"
                  />
                </div>

                <pre className="text-xs leading-5 font-mono whitespace-pre-wrap">
                  {SAMPLE.slice(0, 260)}…
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
