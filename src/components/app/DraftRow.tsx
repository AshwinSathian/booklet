"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { DraftMeta } from "@/lib/drafts";
import { formatRelativeTimeFromIso, formatUpdatedAtLong } from "@/lib/ui/time";
import { isValidDraftTitle } from "./useDraftListActions";

function RowIconButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Button variant={danger ? "danger" : "ghost"} size="sm" iconOnly aria-label={label} title={label} onClick={onClick}>
      {children}
    </Button>
  );
}

export function DraftRow({
  draft,
  isActive,
  isEditing,
  editingTitle,
  onEditingTitleChange,
  isConfirmingDelete,
  variant,
  onOpen,
  onBeginRename,
  onCancelRename,
  onCommitRename,
  onDuplicate,
  onDelete,
  onCancelDeleteConfirm,
}: {
  draft: DraftMeta;
  isActive: boolean;
  isEditing: boolean;
  editingTitle: string;
  onEditingTitleChange: (v: string) => void;
  isConfirmingDelete: boolean;
  /** "dialog": rounded-xl card, actions hidden until row hover (desktop
   * pointer). "drawer": rounded-lg card, actions always visible (touch). */
  variant: "dialog" | "drawer";
  onOpen: () => void;
  onBeginRename: () => void;
  onCancelRename: () => void;
  onCommitRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Dismisses the inline delete-confirmation bar without deleting —
   * distinct from `onDelete`, which the confirm bar's own "Delete" button
   * still calls (a second click there is what actually deletes, matching
   * the two-click confirm pattern the hook's `onDelete` implements). */
  onCancelDeleteConfirm: () => void;
}) {
  const updatedLong = formatUpdatedAtLong(draft.updatedAt);
  const updatedRel = formatRelativeTimeFromIso(draft.updatedAt);
  const updated = updatedRel && updatedRel !== updatedLong ? `${updatedRel} · ${updatedLong}` : updatedLong;
  const isDialog = variant === "dialog";

  return (
    <div
      className={[
        isDialog ? "group rounded-xl" : "rounded-lg",
        "border p-3 transition flex flex-col gap-2",
        isActive ? "border-accent-soft/40 bg-accent/5" : isDialog ? "border-border-default hover:border-border-default/80" : "border-border-subtle bg-bg-elevated",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              value={editingTitle}
              onChange={(e) => onEditingTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); onCommitRename(); }
                if (e.key === "Escape") { e.preventDefault(); onCancelRename(); }
              }}
              onBlur={onCommitRename}
              autoFocus
              className="w-full rounded-md border border-accent-soft bg-bg px-2 py-0.5 text-sm font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
              aria-label="Draft title"
            />
          ) : (
            <div className="truncate text-sm font-medium text-text-primary">
              {draft.title?.trim() ? draft.title : "Untitled"}
            </div>
          )}
          {updated ? <div className="mt-0.5 text-xs text-text-muted">{updated}</div> : null}
        </div>

        <div className={["flex shrink-0 items-center gap-0.5", isDialog ? "opacity-0 group-hover:opacity-100 transition" : ""].join(" ")}>
          <RowIconButton label={isEditing ? "Save rename" : "Open draft"} onClick={isEditing ? onCommitRename : onOpen}>
            <Icon name={isEditing ? "check" : "external"} size={13} />
          </RowIconButton>
          <RowIconButton label="Rename" onClick={isEditing ? onCancelRename : onBeginRename}>
            <Icon name="pencil" size={13} />
          </RowIconButton>
          <RowIconButton label="Duplicate" onClick={onDuplicate}>
            <Icon name="duplicate" size={13} />
          </RowIconButton>
          <RowIconButton label="Delete" danger onClick={onDelete}>
            <Icon name="trash" size={13} />
          </RowIconButton>
        </div>
      </div>

      {isEditing && !isValidDraftTitle(editingTitle) ? (
        <div className="text-xs text-red-400">A title is required.</div>
      ) : null}

      {isConfirmingDelete ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2">
          <span className="text-xs text-red-400">Delete this draft? You can&apos;t undo this.</span>
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" onClick={onCancelDeleteConfirm}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={onDelete}>Delete</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
