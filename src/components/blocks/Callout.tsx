import type { Block, CalloutKind, DocSettings } from "@/lib/blocks";
import type { IconName } from "@/components/ui/Icon";
import { Icon } from "@/components/ui/Icon";
import { BlockRenderer } from "./BlockRenderer";

const CALLOUT_META: Record<
  CalloutKind,
  { icon: IconName; label: string; classes: string }
> = {
  note: {
    icon: "callout-note",
    label: "Note",
    classes: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  },
  tip: {
    icon: "callout-tip",
    label: "Tip",
    classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  warning: {
    icon: "callout-warning",
    label: "Warning",
    classes: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  important: {
    icon: "callout-important",
    label: "Important",
    classes: "border-accent/30 bg-accent/10 text-accent-soft",
  },
  caution: {
    icon: "callout-caution",
    label: "Caution",
    classes: "border-red-500/30 bg-red-500/10 text-red-400",
  },
};

export function Callout({
  kind,
  blocks,
  settings,
  headingAnchors,
  keyPrefix,
}: {
  kind: CalloutKind;
  blocks: Block[];
  settings: DocSettings;
  headingAnchors?: Record<string, string>;
  keyPrefix: string;
}) {
  const meta = CALLOUT_META[kind];

  return (
    <div className={["rounded-xl border p-4", meta.classes].join(" ")}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold">
        <Icon name={meta.icon} size={15} />
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
        />
      </div>
    </div>
  );
}
