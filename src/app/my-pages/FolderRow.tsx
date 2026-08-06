"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useState } from "react";
import type { CollectionRow } from "./MyPagesClient";

export function FolderRow({
  folder,
  itemCount,
  selected,
  onSelectClick,
  onOpen,
  onDelete,
  renaming,
  onCommitRename,
  onCancelRename,
  isDropTarget,
  draggable,
  onDragStartFolder,
  onDragEndFolder,
  onDragOver,
  onDrop,
  onContextMenu,
}: {
  folder: CollectionRow;
  itemCount: number;
  selected: boolean;
  onSelectClick: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onDelete: () => void;
  renaming: boolean;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  isDropTarget: boolean;
  draggable: boolean;
  onDragStartFolder: (e: React.DragEvent) => void;
  onDragEndFolder: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [draft, setDraft] = useState(folder.name);

  return (
    <div
      className={[
        "group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition cursor-default",
        selected ? "border-accent-soft/40 bg-accent-dim" : "border-border-default bg-bg-elevated",
        isDropTarget ? "ring-1 ring-accent/50 bg-accent-dim" : "",
      ].join(" ")}
      draggable={draggable}
      onDragStart={onDragStartFolder}
      onDragEnd={onDragEndFolder}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelectClick}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <Icon name="folder" size={16} className="shrink-0 text-accent/80" />
      {renaming ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onCommitRename(draft.trim() || folder.name); }
            if (e.key === "Escape") { e.preventDefault(); setDraft(folder.name); onCancelRename(); }
          }}
          onBlur={() => onCommitRename(draft.trim() || folder.name)}
          className="min-w-0 flex-1 rounded-md border border-accent/40 bg-bg px-1.5 py-0.5 text-sm text-text-primary focus-visible:outline-none"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">{folder.name}</span>
      )}
      <span className="shrink-0 text-xs text-text-muted tabular-nums">
        {itemCount === 1 ? "1 item" : `${itemCount} items`}
      </span>
      <Button
        variant="danger" size="sm" iconOnly
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={`Delete ${folder.name}`} title={`Delete ${folder.name}`}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"
      >
        <Icon name="trash" size={12} />
      </Button>
    </div>
  );
}
