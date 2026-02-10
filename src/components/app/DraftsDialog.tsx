"use client";

import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS, hashId } from "@/lib/analytics-events";
import {
  DRAFTS_STORAGE_KEYS,
  deleteDraft,
  duplicateDraft,
  listDrafts,
  updateDraft,
  type DraftMeta,
} from "@/lib/drafts";
import { formatRelativeTimeFromIso, formatUpdatedAtLong } from "@/lib/ui/time";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { useCallback, useEffect, useRef, useState } from "react";

const LABELS = {
  header: "My drafts",

  emptyTitle: "No drafts yet.",
  emptyBody:
    "Drafts live on this device and autosave as you type. Publish creates a shareable snapshot; your draft stays editable.",

  updated: "Updated",
  open: "Open",
  rename: "Rename",
  duplicate: "Duplicate",
  delete: "Delete",

  newDraft: "New draft",
  importMarkdown: "Import Markdown",
  close: "Close",

  deleteConfirm: "Delete this draft? This cannot be undone.",
  titlePlaceholder: "Untitled",
  titleEmptyError: "Title cannot be empty.",
} as const;

function isValidTitle(title: string): boolean {
  return title.trim().length > 0;
}

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
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  const refreshTimerRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    setDrafts(listDrafts());
  }, []);

  useEffect(() => {
    if (!visible) return;
    refresh();

    // Keep the list fresh while open (autosaves update timestamps).
    refreshTimerRef.current = window.setInterval(() => refresh(), 1200);

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === DRAFTS_STORAGE_KEYS.db) refresh();
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
      if (refreshTimerRef.current !== null) {
        window.clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [refresh, visible]);

  const beginRename = useCallback((d: DraftMeta) => {
    setEditingId(d.id);
    setEditingTitle(d.title);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
  }, []);

  const commitRename = useCallback(() => {
    if (!editingId) return;
    const next = editingTitle.trim();
    if (!isValidTitle(next)) return;

    updateDraft(editingId, { title: next });

    trackEvent(ANALYTICS_EVENTS.draft_renamed, {
      draft_hash: hashId(editingId),
    });

    cancelRename();
    refresh();
  }, [cancelRename, editingId, editingTitle, refresh]);

  const onDuplicate = useCallback(
    (id: string) => {
      const copy = duplicateDraft(id);

      trackEvent(ANALYTICS_EVENTS.draft_duplicated, {
        draft_hash: hashId(id),
        new_draft_hash: copy ? hashId(copy.id) : "",
      });

      refresh();
    },
    [refresh],
  );

  const onDelete = useCallback(
    (id: string) => {
      const ok = window.confirm(LABELS.deleteConfirm);
      if (!ok) return;

      const deletingActive = id === activeDraftId;
      deleteDraft(id);

      trackEvent(ANALYTICS_EVENTS.draft_deleted, {
        draft_hash: hashId(id),
        deleting_active: deletingActive,
      });

      cancelRename();

      const nextDrafts = listDrafts();
      setDrafts(nextDrafts);

      if (!deletingActive) return;

      const nextId = nextDrafts[0]?.id;
      if (nextId) {
        onOpenDraft(nextId, "drafts_dialog");
        onHide();
        return;
      }

      // If the last draft was deleted, ensure the app remains usable.
      onCreateDraft("drafts_dialog");
      onHide();
    },
    [activeDraftId, cancelRename, onCreateDraft, onHide, onOpenDraft],
  );

  const footer = (
    <div className="flex items-center justify-between gap-2 w-full">
      <div className="flex items-center gap-2">
        <Button
          label={LABELS.newDraft}
          icon="pi pi-plus"
          severity="success"
          onClick={() => {
            const id = onCreateDraft("drafts_dialog");
            trackEvent(ANALYTICS_EVENTS.draft_created, {
              draft_hash: hashId(id),
              origin: "drafts_dialog",
            });
            onHide();
          }}
          className="uppercase"
        />

        <Button
          label={LABELS.importMarkdown}
          icon="pi pi-file-import"
          severity="secondary"
          onClick={() => onRequestImportMarkdown()}
          className="uppercase"
          outlined
        />
      </div>

      <Button
        label={LABELS.close}
        text
        onClick={onHide}
        className="uppercase"
      />
    </div>
  );

  return (
    <Dialog
      header={LABELS.header}
      visible={visible}
      className="w-[92vw] md:w-[56vw]"
      footer={footer}
      onHide={onHide}
    >
      <div className="px-1 py-2">
        {drafts.length === 0 ? (
          <div className="rounded-2xl border border-[rgb(var(--border))] bg-bg-glass/40 p-4 md:p-5">
            <div className="text-base font-semibold">{LABELS.emptyTitle}</div>
            <div className="mt-2 text-sm text-[rgb(var(--muted))] leading-relaxed">
              {LABELS.emptyBody}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                label={LABELS.newDraft}
                icon="pi pi-plus"
                severity="success"
                onClick={() => {
                  const id = onCreateDraft("drafts_dialog");
                  trackEvent(ANALYTICS_EVENTS.draft_created, {
                    draft_hash: hashId(id),
                    origin: "drafts_dialog",
                  });
                  onHide();
                }}
                className="uppercase"
              />

              <Button
                label={LABELS.importMarkdown}
                icon="pi pi-file-import"
                severity="secondary"
                onClick={() => onRequestImportMarkdown()}
                className="uppercase"
                outlined
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {drafts.map((d) => {
              const isActive = d.id === activeDraftId;
              const isEditing = editingId === d.id;

              const updatedLong = formatUpdatedAtLong(d.updatedAt);
              const updatedRel = formatRelativeTimeFromIso(d.updatedAt);

              const updated =
                updatedRel && updatedRel !== updatedLong
                  ? `${updatedRel} • ${updatedLong}`
                  : updatedLong;

              return (
                <div
                  key={d.id}
                  className={[
                    "rounded-xl border border-[rgb(var(--border))] p-3",
                    "flex flex-col gap-2 transition-colors",
                    isActive ? "ring-1 ring-accent-soft" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <InputText
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitRename();
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                          onBlur={() => commitRename()}
                          className="w-full"
                          autoFocus
                        />
                      ) : (
                        <div className="font-medium truncate">
                          {d.title?.trim() ? d.title : LABELS.titlePlaceholder}
                        </div>
                      )}

                      {updated ? (
                        <div className="mt-1 text-xs text-[rgb(var(--muted))]">
                          {LABELS.updated}: {updated}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        label={LABELS.open}
                        size="small"
                        icon="pi pi-folder-open"
                        onClick={() => {
                          trackEvent(ANALYTICS_EVENTS.draft_opened, {
                            draft_hash: hashId(d.id),
                            origin: "drafts_dialog",
                            is_active: isActive,
                          });
                          onOpenDraft(d.id, "drafts_dialog");
                          onHide();
                        }}
                        className="uppercase"
                        text
                      />

                      {isEditing ? (
                        <Button
                          icon="pi pi-check"
                          size="small"
                          onClick={() => commitRename()}
                          disabled={!isValidTitle(editingTitle)}
                          text
                        />
                      ) : (
                        <Button
                          icon="pi pi-pencil"
                          size="small"
                          onClick={() => beginRename(d)}
                          text
                        />
                      )}

                      <Button
                        icon="pi pi-clone"
                        size="small"
                        onClick={() => onDuplicate(d.id)}
                        text
                      />

                      <Button
                        icon="pi pi-trash"
                        size="small"
                        severity="danger"
                        onClick={() => onDelete(d.id)}
                        text
                      />
                    </div>
                  </div>

                  {isEditing && !isValidTitle(editingTitle) ? (
                    <div className="text-xs text-red-500">
                      {LABELS.titleEmptyError}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}
