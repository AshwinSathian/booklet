"use client";

import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS, hashId } from "@/lib/analytics-events";
import { useEffect, useRef } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { DraftRow } from "./DraftRow";
import { useDraftListActions } from "./useDraftListActions";

export function DraftsDialog({
  visible,
  activeDraftId,
  onHide,
  onOpenDraft,
  onCreateDraft,
  onRequestImportMarkdown,
}: {
  visible: boolean;
  activeDraftId: string | null;
  onHide: () => void;
  onOpenDraft: (id: string, origin?: "drafts_dialog") => void;
  onCreateDraft: (origin?: "drafts_dialog") => string;
  onRequestImportMarkdown: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const actions = useDraftListActions({
    active: visible,
    activeDraftId,
    onOpenDraft,
    onCreateDraft,
    onActiveDraftDeleted: onHide,
  });

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onHide(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-40 flex items-center justify-center bg-bg/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onHide(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="My drafts"
        className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-card border border-border-default bg-bg-elevated shadow-glass animate-dialog-in"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-default/60 shrink-0">
          <span className="text-sm font-semibold">My drafts</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onRequestImportMarkdown}>
              <Icon name="download" size={12} />
              Import
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const id = onCreateDraft("drafts_dialog");
                trackEvent(ANALYTICS_EVENTS.draft_created, { draft_hash: hashId(id), origin: "drafts_dialog" });
                onHide();
              }}
            >
              <Icon name="plus" size={12} />
              New draft
            </Button>
            <Button variant="ghost" size="sm" iconOnly onClick={onHide} aria-label="Close">
              <Icon name="close" size={14} />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-3">
          {actions.drafts.length === 0 ? (
            <div className="rounded-xl border border-border-default/60 bg-bg-glass/40 p-5">
              <div className="text-sm font-semibold">No drafts yet.</div>
              <div className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                Drafts autosave to your browser. Publishing creates a shareable link — your draft stays here, ready to edit.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {actions.drafts.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  isActive={d.id === activeDraftId}
                  isEditing={actions.editingId === d.id}
                  editingTitle={actions.editingTitle}
                  onEditingTitleChange={actions.setEditingTitle}
                  isConfirmingDelete={actions.confirmDeleteId === d.id}
                  variant="dialog"
                  onOpen={() => { actions.onOpen(d.id); onHide(); }}
                  onBeginRename={() => actions.beginRename(d)}
                  onCancelRename={actions.cancelRename}
                  onCommitRename={actions.commitRename}
                  onDuplicate={() => actions.onDuplicate(d.id)}
                  onDelete={() => actions.onDelete(d.id)}
                  onCancelDeleteConfirm={actions.cancelDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
