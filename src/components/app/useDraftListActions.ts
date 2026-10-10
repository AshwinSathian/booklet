"use client";

import {
  DRAFTS_STORAGE_KEYS,
  deleteDraft,
  duplicateDraft,
  listDrafts,
  updateDraft,
  type DraftMeta,
} from "@/lib/drafts";
import { useCallback, useEffect, useState } from "react";

export function isValidDraftTitle(title: string): boolean {
  return title.trim().length > 0;
}

/**
 * Drafts-list state machine (rename / duplicate / delete-with-confirmation)
 * shared by every surface that lists local drafts: the desktop `DraftsDialog`
 * (⌘D) and the mobile `MoreActionsDrawer`'s drafts view. Both previously
 * carried their own ~90-line copy of this exact logic — this hook is the
 * single source of truth; the two surfaces differ only in chrome (modal vs.
 * drawer), handled by their own JSX plus `DraftRow`'s `variant` prop.
 */
export function useDraftListActions({
  active,
  activeDraftId,
  onOpenDraft,
  onCreateDraft,
  onActiveDraftDeleted,
}: {
  /** Only refreshes/subscribes while true — e.g. a dialog that isn't visible
   * shouldn't listen for storage events. */
  active: boolean;
  activeDraftId: string | null;
  onOpenDraft: (id: string) => void;
  onCreateDraft: () => string;
  /** Called after a fallback switch/create, but only when the draft that was
   * deleted was the currently-open one — the caller uses this to close its
   * own dialog/drawer, mirroring the original inline onHide()/onClose()
   * calls this hook replaces. Not called when deleting a non-active draft. */
  onActiveDraftDeleted: () => void;
}) {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = useCallback(() => setDrafts(listDrafts()), []);

  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  useEffect(() => {
    if (!active) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === DRAFTS_STORAGE_KEYS.db) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [active, refresh]);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
  }, []);

  const beginRename = useCallback((draft: DraftMeta) => {
    setEditingId(draft.id);
    setEditingTitle(draft.title);
    setConfirmDeleteId(null);
  }, []);

  const commitRename = useCallback(() => {
    if (!editingId) return;
    const next = editingTitle.trim();
    if (!isValidDraftTitle(next)) return;
    updateDraft(editingId, { title: next });
    cancelRename();
    refresh();
  }, [cancelRename, editingId, editingTitle, refresh]);

  const onOpen = useCallback(
    (id: string) => {
      onOpenDraft(id);
    },
    [onOpenDraft],
  );

  const onDuplicate = useCallback((id: string) => {
    duplicateDraft(id);
    refresh();
  }, [refresh]);

  const onDelete = useCallback(
    (id: string) => {
      if (confirmDeleteId !== id) {
        setConfirmDeleteId(id);
        return;
      }

      const deletingActive = id === activeDraftId;
      deleteDraft(id);
      cancelRename();
      setConfirmDeleteId(null);

      const nextDrafts = listDrafts();
      setDrafts(nextDrafts);

      if (!deletingActive) return;

      const nextId = nextDrafts[0]?.id;
      if (nextId) {
        onOpenDraft(nextId);
      } else {
        onCreateDraft();
      }
      onActiveDraftDeleted();
    },
    [activeDraftId, cancelRename, confirmDeleteId, onActiveDraftDeleted, onCreateDraft, onOpenDraft],
  );

  const cancelDelete = useCallback(() => setConfirmDeleteId(null), []);

  return {
    drafts,
    editingId,
    editingTitle,
    setEditingTitle,
    confirmDeleteId,
    beginRename,
    cancelRename,
    commitRename,
    onOpen,
    onDuplicate,
    onDelete,
    cancelDelete,
  };
}
