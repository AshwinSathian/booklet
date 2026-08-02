"use client";

import { listDrafts, type DraftMeta } from "@/lib/drafts";
import { buildWikilinkIndex } from "@/lib/wikilinks";
import { computeForceLayout, type GraphPoint } from "@/lib/wikilinks/layout";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

const SIZE = 560;

export function GraphView({
  visible,
  activeDraftId,
  onHide,
  onOpenDraft,
}: {
  visible: boolean;
  activeDraftId: string | null;
  onHide: () => void;
  onOpenDraft: (id: string) => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [edges, setEdges] = useState<{ source: string; target: string }[]>([]);

  // Recompute once per open — the graph doesn't need to track live typing,
  // only the state of the vault at the moment someone opens it.
  useEffect(() => {
    if (!visible) return;
    setDrafts(listDrafts());
    setEdges(buildWikilinkIndex().edges);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onHide();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, onHide]);

  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of edges) {
      d.set(e.source, (d.get(e.source) ?? 0) + 1);
      d.set(e.target, (d.get(e.target) ?? 0) + 1);
    }
    return d;
  }, [edges]);

  const positions: Record<string, GraphPoint> = useMemo(
    () =>
      computeForceLayout(
        drafts.map((d) => d.id),
        edges,
        { width: SIZE, height: SIZE },
      ),
    [drafts, edges],
  );

  if (!visible) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-40 flex items-center justify-center bg-bg/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onHide();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Draft graph"
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-card border border-border-default bg-bg-elevated shadow-glass animate-dialog-in"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-default/60 shrink-0">
          <div>
            <span className="text-sm font-semibold">Graph</span>
            <p className="mt-0.5 text-xs text-text-muted">
              Private to you — {drafts.length} draft{drafts.length === 1 ? "" : "s"},{" "}
              {edges.length} link{edges.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button variant="ghost" size="sm" iconOnly onClick={onHide} aria-label="Close">
            <Icon name="close" size={14} />
          </Button>
        </div>

        <div className="overflow-auto flex-1 flex items-center justify-center p-3">
          {drafts.length === 0 ? (
            <div className="p-6 text-sm text-text-secondary">No drafts yet.</div>
          ) : (
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              role="img"
              aria-label="Graph of linked drafts"
            >
              <g>
                {edges.map((e, i) => {
                  const a = positions[e.source];
                  const b = positions[e.target];
                  if (!a || !b) return null;
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="currentColor"
                      className="text-border-default"
                      strokeWidth={1}
                    />
                  );
                })}
              </g>
              <g>
                {drafts.map((d) => {
                  const p = positions[d.id];
                  if (!p) return null;
                  const r = 4 + Math.min(8, degree.get(d.id) ?? 0);
                  const isActive = d.id === activeDraftId;
                  return (
                    <g
                      key={d.id}
                      transform={`translate(${p.x}, ${p.y})`}
                      onClick={() => {
                        onOpenDraft(d.id);
                        onHide();
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        r={r}
                        className={
                          isActive
                            ? "fill-accent stroke-accent-soft"
                            : "fill-accent-soft/70 stroke-accent/40 hover:fill-accent"
                        }
                        strokeWidth={1.5}
                      />
                      <text
                        x={r + 4}
                        y={4}
                        className="fill-text-secondary text-[10px] select-none"
                      >
                        {(d.title || "Untitled").slice(0, 28)}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
