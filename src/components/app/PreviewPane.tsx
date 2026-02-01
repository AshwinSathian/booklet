"use client";

import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { Block, DocSettings } from "@/lib/blocks";

export function PreviewPane({
  blocks,
  settings,
  isEmpty,
}: {
  blocks: Block[];
  settings: DocSettings;
  isEmpty: boolean;
}) {
  return (
    <div className="flex h-full max-h-full min-h-0 flex-col w-full overflow-hidden">
      <div className="shrink-0 px-3 py-2 text-xs text-text-primary text-sm uppercase tracking-wide">
        This is a preview. Publish to make this public and accessible by link.
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto rounded-sm border border-outline bg-bg-glass p-3">
        {isEmpty ? (
          <div className="flex h-full w-full items-center justify-center px-6 py-4 text-center text-sm text-[rgb(var(--muted))]">
            <div className="uppercase tracking-wide text-gray-400">
              <div className="text-lg font-semibold mb-2">
                A clean shareable page, instantly.
              </div>
              <div className="leading-6">
                Paste content on the left. We’ll format it into a page that’s
                easy to read and easy to share.
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
