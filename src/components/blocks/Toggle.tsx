import type { Block, DocSettings } from "@/lib/blocks";
import { Icon } from "@/components/ui/Icon";
import type { WikilinkRenderCtx } from "@/lib/wikilinks/render-context";
import { BlockRenderer } from "./BlockRenderer";

export function Toggle({
  summary,
  blocks,
  settings,
  headingAnchors,
  keyPrefix,
  wikilinkCtx,
}: {
  summary: string;
  blocks: Block[];
  settings: DocSettings;
  headingAnchors?: Record<string, string>;
  keyPrefix: string;
  wikilinkCtx?: WikilinkRenderCtx;
}) {
  return (
    <details className="group rounded-xl border border-border-default bg-bg-elevated px-4 py-3 open:pb-4">
      <summary className="flex cursor-pointer select-none items-center gap-2 text-[14px] font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-text-muted transition-transform duration-150 group-open:rotate-90">
          <Icon name="chevron-right" size={12} />
        </span>
        {summary}
      </summary>
      <div className="mt-3 text-text-primary [&>div>*:first-child]:mt-0 [&>div>*:last-child]:mb-0">
        <BlockRenderer
          blocks={blocks}
          settings={settings}
          headingAnchors={headingAnchors}
          keyPrefix={keyPrefix}
          wikilinkCtx={wikilinkCtx}
        />
      </div>
    </details>
  );
}
