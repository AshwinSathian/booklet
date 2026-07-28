import type { Block, DocSettings } from "@/lib/blocks";
import type { WikilinkRenderCtx } from "@/lib/wikilinks/render-context";
import { BlockRenderer } from "./BlockRenderer";

// Written out as literal class strings (not built from a template literal)
// so Tailwind's static scanner can see every possible class at build time —
// a runtime-interpolated `grid-cols-${n}` string would not be picked up.
const GRID_COLS_CLASS: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-4",
};

export function Columns({
  columns,
  settings,
  headingAnchors,
  keyPrefix,
  wikilinkCtx,
}: {
  columns: Block[][];
  settings: DocSettings;
  headingAnchors?: Record<string, string>;
  keyPrefix: string;
  wikilinkCtx?: WikilinkRenderCtx;
}) {
  const gridClass = GRID_COLS_CLASS[columns.length] ?? GRID_COLS_CLASS[2];

  return (
    <div className={["grid gap-4", gridClass].join(" ")}>
      {columns.map((col, i) => (
        <div key={i} className="min-w-0 [&>div>*:first-child]:mt-0">
          <BlockRenderer
            blocks={col}
            settings={settings}
            headingAnchors={headingAnchors}
            keyPrefix={`${keyPrefix}.${i}`}
            wikilinkCtx={wikilinkCtx}
          />
        </div>
      ))}
    </div>
  );
}
