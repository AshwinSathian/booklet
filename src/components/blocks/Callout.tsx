import type { Block, CalloutKind, DocSettings } from "@/lib/blocks";
import type { IconName } from "@/components/ui/Icon";
import { Icon } from "@/components/ui/Icon";
import { CALLOUT_META } from "@/lib/render-shared";
import type { WikilinkRenderCtx } from "@/lib/wikilinks/render-context";
import { BlockRenderer } from "./BlockRenderer";

// Tailwind color classes are React/CSS-specific and have no equivalent in
// the HTML string exporter (which uses inline hex colors for portability
// into email/doc-paste targets with no external stylesheet) — those stay
// separate per output format. The label text, however, must not drift
// between what a reader sees and what an export produces, so it's sourced
// from the one shared table (src/lib/render-shared.ts) both places read.
const CALLOUT_ICON_CLASSES: Record<CalloutKind, { icon: IconName; classes: string }> = {
  note: { icon: "callout-note", classes: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
  tip: { icon: "callout-tip", classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  warning: { icon: "callout-warning", classes: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  important: { icon: "callout-important", classes: "border-accent/30 bg-accent/10 text-accent-soft" },
  caution: { icon: "callout-caution", classes: "border-red-500/30 bg-red-500/10 text-red-400" },
};

export function Callout({
  kind,
  blocks,
  settings,
  headingAnchors,
  keyPrefix,
  wikilinkCtx,
}: {
  kind: CalloutKind;
  blocks: Block[];
  settings: DocSettings;
  headingAnchors?: Record<string, string>;
  keyPrefix: string;
  wikilinkCtx?: WikilinkRenderCtx;
}) {
  const meta = CALLOUT_META[kind];
  const iconMeta = CALLOUT_ICON_CLASSES[kind];

  return (
    <div className={["rounded-xl border p-4", iconMeta.classes].join(" ")}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold">
        <Icon name={iconMeta.icon} size={15} />
        <span>{meta.label}</span>
      </div>
      {/* Nested content keeps the surrounding document's text color (not the
          callout accent color) — only the header icon/label carry the tint,
          matching the GitHub/Obsidian convention this syntax is based on. */}
      <div className="text-text-primary [&>div>*:first-child]:mt-0 [&>div>*:last-child]:mb-0">
        <BlockRenderer
          blocks={blocks}
          settings={settings}
          headingAnchors={headingAnchors}
          keyPrefix={keyPrefix}
          wikilinkCtx={wikilinkCtx}
        />
      </div>
    </div>
  );
}
