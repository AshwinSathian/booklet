"use client";

import {
  DRAFTS_STORAGE_KEYS,
  deleteDraft,
  duplicateDraft,
  listDrafts,
  updateDraft,
  type DraftMeta,
} from "@/lib/drafts";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { useCallback, useEffect, useRef, useState } from "react";

const LABELS = {
  header: "My drafts",
  empty: "No drafts yet.",
  updated: "Updated",
  open: "Open",
  rename: "Rename",
  duplicate: "Duplicate",
  delete: "Delete",
  newDraft: "New draft",
  close: "Close",
  deleteConfirm: "Delete this draft? This cannot be undone.",
  titlePlaceholder: "Untitled",
  titleEmptyError: "Title cannot be empty.",
} as const;

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isValidTitle(title: string): boolean {
  return title.trim().length > 0;
}

export function DraftsDialog({
  visible,
  activeDraftId,
  onHide,
  onOpenDraft,
  onCreateDraft,
}: {
  visible: boolean;
  activeDraftId: string | null;
  onHide: () => void;
  onOpenDraft: (id: string) => void;
  onCreateDraft: () => string;
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
    cancelRename();
    refresh();
  }, [cancelRename, editingId, editingTitle, refresh]);

  const onDuplicate = useCallback(
    (id: string) => {
      duplicateDraft(id);
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
      cancelRename();

      const nextDrafts = listDrafts();
      setDrafts(nextDrafts);

      if (!deletingActive) return;

      const nextId = nextDrafts[0]?.id;
      if (nextId) {
        onOpenDraft(nextId);
        onHide();
        return;
      }

      // If the last draft was deleted, ensure the app remains usable.
      onCreateDraft();
      onHide();
    },
    [activeDraftId, cancelRename, onCreateDraft, onHide, onOpenDraft],
  );

  const footer = (
    <div className="flex items-center justify-between gap-2 w-full">
      <Button
        label={LABELS.newDraft}
        icon="pi pi-plus"
        severity="success"
        onClick={() => {
          onCreateDraft();
          onHide();
        }}
        className="uppercase"
      />

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
          <div className="text-sm text-[rgb(var(--muted))]">{LABELS.empty}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {drafts.map((d) => {
              const isActive = d.id === activeDraftId;
              const isEditing = editingId === d.id;
              const updated = formatUpdatedAt(d.updatedAt);

              return (
                <div
                  key={d.id}
                  className={[
                    "rounded-xl border border-[rgb(var(--border))] p-3",
                    "flex flex-col gap-2",
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
                          onOpenDraft(d.id);
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
