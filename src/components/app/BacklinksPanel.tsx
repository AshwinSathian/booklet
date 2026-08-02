"use client";

import type { BacklinkEntry } from "@/lib/wikilinks";
import { useEffect, useRef } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

export function BacklinksPanel({
  visible,
  draftTitle,
  backlinks,
  onHide,
  onOpenDraft,
}: {
  visible: boolean;
  draftTitle: string;
  backlinks: BacklinkEntry[];
  onHide: () => void;
  onOpenDraft: (id: string) => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onHide();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, onHide]);

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
        aria-label="Linked mentions"
        className="relative w-full max-w-md max-h-[70vh] flex flex-col rounded-card border border-border-default bg-bg-elevated shadow-glass animate-dialog-in"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-default/60 shrink-0">
          <div className="min-w-0">
            <span className="text-sm font-semibold">Linked mentions</span>
            <p className="mt-0.5 truncate text-xs text-text-muted">
              Drafts that reference “{draftTitle || "Untitled"}”
            </p>
          </div>
          <Button variant="ghost" size="sm" iconOnly onClick={onHide} aria-label="Close">
            <Icon name="close" size={14} />
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-3">
          {backlinks.length === 0 ? (
            <div className="rounded-xl border border-border-default/60 bg-bg-glass/40 p-5">
              <div className="text-sm font-semibold">No linked mentions yet.</div>
              <div className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                Reference this draft from another one with{" "}
                <code className="rounded bg-fill-2 px-1 py-0.5 text-xs">
                  [[{draftTitle || "Untitled"}]]
                </code>{" "}
                and it will show up here.
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {backlinks.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenDraft(b.id);
                      onHide();
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary transition hover:bg-fill-2"
                  >
                    {b.title || "Untitled"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
