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
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../ui/Icon";

function isValidTitle(title: string): boolean {
  return title.trim().length > 0;
}

function IconBtn({
  label,
  onClick,
  children,
  danger,
  active,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={[
        "flex h-7 w-7 items-center justify-center rounded-md transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
        danger
          ? "text-red-400 hover:bg-red-500/12 hover:text-red-300"
          : active
            ? "bg-outline/30 text-text-primary"
            : "text-text-muted hover:bg-outline/30 hover:text-text-primary",
      ].join(" ")}
    >
      {children}
    </button>
  );
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => setDrafts(listDrafts()), []);

  /* ── Refresh drafts list when opened ── */
  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  /* ── Close on Escape ── */
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onHide(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, onHide]);

  /* ── Sync storage changes ── */
  useEffect(() => {
    if (!visible) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === DRAFTS_STORAGE_KEYS.db) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh, visible]);

  const beginRename = useCallback((d: DraftMeta) => {
    setEditingId(d.id);
    setEditingTitle(d.title);
    setConfirmDeleteId(null);
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
    trackEvent(ANALYTICS_EVENTS.draft_renamed, { draft_hash: hashId(editingId) });
    cancelRename();
    refresh();
  }, [cancelRename, editingId, editingTitle, refresh]);

  const onDuplicate = useCallback((id: string) => {
    const copy = duplicateDraft(id);
    trackEvent(ANALYTICS_EVENTS.draft_duplicated, {
      draft_hash: hashId(id),
      new_draft_hash: copy ? hashId(copy.id) : "",
    });
    refresh();
  }, [refresh]);

  const onDelete = useCallback((id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }

    const deletingActive = id === activeDraftId;
    deleteDraft(id);
    trackEvent(ANALYTICS_EVENTS.draft_deleted, {
      draft_hash: hashId(id),
      deleting_active: deletingActive,
    });
    cancelRename();
    setConfirmDeleteId(null);

    const nextDrafts = listDrafts();
    setDrafts(nextDrafts);

    if (!deletingActive) return;

    const nextId = nextDrafts[0]?.id;
    if (nextId) {
      onOpenDraft(nextId, "drafts_dialog");
      onHide();
      return;
    }
    onCreateDraft("drafts_dialog");
    onHide();
  }, [activeDraftId, cancelRename, confirmDeleteId, onCreateDraft, onHide, onOpenDraft]);

  if (!visible) return null;

  return (
    /* Backdrop */
    <div
      ref={backdropRef}
      className="fixed inset-0 z-40 flex items-center justify-center bg-bg/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onHide();
      }}
    >
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="My drafts"
        className={[
          "relative w-full max-w-lg max-h-[80vh] flex flex-col",
          "rounded-card border border-outline bg-bg-elevated shadow-glass",
          "animate-dialog-in",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-outline/60 shrink-0">
          <span className="text-sm font-semibold">My drafts</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onRequestImportMarkdown()}
              className="flex items-center gap-1.5 rounded-input border border-outline px-2.5 py-1 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
            >
              <Icon name="download" size={12} />
              Import
            </button>
            <button
              type="button"
              onClick={() => {
                const id = onCreateDraft("drafts_dialog");
                trackEvent(ANALYTICS_EVENTS.draft_created, { draft_hash: hashId(id), origin: "drafts_dialog" });
                onHide();
              }}
              className="flex items-center gap-1.5 rounded-input bg-accent px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-accent-hover"
            >
              <Icon name="plus" size={12} />
              New draft
            </button>
            <button
              type="button"
              onClick={onHide}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition hover:bg-outline/30 hover:text-text-primary"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-3 py-3">
          {drafts.length === 0 ? (
            <div className="rounded-xl border border-outline/60 bg-bg-glass/40 p-5">
              <div className="text-sm font-semibold">No drafts yet.</div>
              <div className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                Drafts live on this device and autosave as you type. Publish creates a shareable
                snapshot; your draft stays editable.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {drafts.map((d) => {
                const isActive = d.id === activeDraftId;
                const isEditing = editingId === d.id;
                const isConfirmingDelete = confirmDeleteId === d.id;

                const updatedLong = formatUpdatedAtLong(d.updatedAt);
                const updatedRel = formatRelativeTimeFromIso(d.updatedAt);
                const updated = updatedRel && updatedRel !== updatedLong
                  ? `${updatedRel} · ${updatedLong}`
                  : updatedLong;

                return (
                  <div
                    key={d.id}
                    className={[
                      "group rounded-xl border p-3 transition",
                      "flex flex-col gap-2",
                      isActive
                        ? "border-accent-soft/40 bg-accent/5"
                        : "border-outline hover:border-outline/80",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                              if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                            }}
                            onBlur={commitRename}
                            autoFocus
                            className="w-full rounded-md border border-accent-soft bg-bg px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-soft"
                            aria-label="Draft title"
                          />
                        ) : (
                          <div className="text-sm font-medium truncate">
                            {d.title?.trim() ? d.title : "Untitled"}
                          </div>
                        )}
                        {updated ? (
                          <div className="mt-0.5 text-xs text-text-muted">
                            {updated}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        {isEditing ? (
                          <IconBtn label="Save rename" onClick={commitRename} active>
                            <Icon name="check" size={13} />
                          </IconBtn>
                        ) : (
                          <IconBtn label="Open draft" onClick={() => {
                            trackEvent(ANALYTICS_EVENTS.draft_opened, { draft_hash: hashId(d.id), origin: "drafts_dialog", is_active: isActive });
                            onOpenDraft(d.id, "drafts_dialog");
                            onHide();
                          }}>
                            <Icon name="external" size={13} />
                          </IconBtn>
                        )}

                        <IconBtn label="Rename" onClick={() => isEditing ? cancelRename() : beginRename(d)}>
                          <Icon name="pencil" size={13} />
                        </IconBtn>

                        <IconBtn label="Duplicate" onClick={() => onDuplicate(d.id)}>
                          <Icon name="duplicate" size={13} />
                        </IconBtn>

                        <IconBtn label="Delete" danger onClick={() => onDelete(d.id)}>
                          <Icon name="trash" size={13} />
                        </IconBtn>
                      </div>
                    </div>

                    {isEditing && !isValidTitle(editingTitle) ? (
                      <div className="text-xs text-red-400">Title cannot be empty.</div>
                    ) : null}

                    {isConfirmingDelete ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2">
                        <span className="text-xs text-red-400">Delete this draft? This cannot be undone.</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="rounded-md px-2 py-0.5 text-xs font-medium text-text-muted transition hover:text-text-primary"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(d.id)}
                            className="rounded-md bg-red-500 px-2 py-0.5 text-xs font-semibold text-white transition hover:bg-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
