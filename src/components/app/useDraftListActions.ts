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
  onOpenDraft: (id: string, origin?: "drafts_dialog") => void;
  onCreateDraft: (origin?: "drafts_dialog") => string;
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
    trackEvent(ANALYTICS_EVENTS.draft_renamed, { draft_hash: hashId(editingId) });
    cancelRename();
    refresh();
  }, [cancelRename, editingId, editingTitle, refresh]);

  const onOpen = useCallback(
    (id: string) => {
      const isActive = id === activeDraftId;
      trackEvent(ANALYTICS_EVENTS.draft_opened, { draft_hash: hashId(id), origin: "drafts_dialog", is_active: isActive });
      onOpenDraft(id, "drafts_dialog");
    },
    [activeDraftId, onOpenDraft],
  );

  const onDuplicate = useCallback((id: string) => {
    const copy = duplicateDraft(id);
    trackEvent(ANALYTICS_EVENTS.draft_duplicated, {
      draft_hash: hashId(id),
      new_draft_hash: copy ? hashId(copy.id) : "",
    });
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
      trackEvent(ANALYTICS_EVENTS.draft_deleted, { draft_hash: hashId(id), deleting_active: deletingActive });
      cancelRename();
      setConfirmDeleteId(null);

      const nextDrafts = listDrafts();
      setDrafts(nextDrafts);

      if (!deletingActive) return;

      const nextId = nextDrafts[0]?.id;
      if (nextId) {
        onOpenDraft(nextId, "drafts_dialog");
      } else {
        onCreateDraft("drafts_dialog");
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
    refresh,
    beginRename,
    cancelRename,
    commitRename,
    onOpen,
    onDuplicate,
    onDelete,
    cancelDelete,
  };
}
