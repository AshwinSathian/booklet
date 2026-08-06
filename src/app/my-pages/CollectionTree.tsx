"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { canNestInto, getChildren, getTeamSpaces } from "@/lib/collections-tree";
import { useState } from "react";
import type { CollectionRow, CollectionFilter, PageRow } from "./MyPagesClient";

function RenameInput({ initialValue, onCommit, onCancel }: { initialValue: string; onCommit: (name: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(initialValue);
  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); onCommit(draft.trim() || initialValue); }
        if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
      onBlur={() => onCommit(draft.trim() || initialValue)}
      className="min-w-0 flex-1 rounded-md border border-accent/40 bg-bg px-1.5 py-0.5 text-sm text-text-primary focus-visible:outline-none"
    />
  );
}

function pageCount(pages: PageRow[], collectionId: CollectionFilter) {
  if (collectionId === "all") return pages.length;
  if (collectionId === "uncollected") return pages.filter((p) => p.collection_id === null).length;
  return pages.filter((p) => p.collection_id === collectionId).length;
}

function Row({
  id,
  label,
  count,
  depth,
  active,
  expandable,
  expanded,
  onToggleExpand,
  canDelete,
  onSelect,
  onDelete,
  isDropTarget,
  onDragOver,
  onDrop,
  draggable,
  onDragStartRow,
  onDragEndRow,
  onContextMenu,
  renaming,
  onCommitRename,
  onCancelRename,
}: {
  id: CollectionFilter;
  label: string;
  count: number;
  depth: number;
  active: boolean;
  expandable: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  canDelete: boolean;
  onSelect: () => void;
  onDelete: () => void;
  isDropTarget: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  draggable?: boolean;
  onDragStartRow?: (e: React.DragEvent) => void;
  onDragEndRow?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  renaming?: boolean;
  onCommitRename?: (name: string) => void;
  onCancelRename?: () => void;
}) {
  return (
    <div
      className={[
        "group flex items-center gap-1 rounded-lg transition",
        isDropTarget ? "bg-accent-dim ring-1 ring-accent/40" : "",
      ].join(" ")}
      style={{ paddingLeft: depth * 14 }}
      draggable={draggable}
      onDragStart={onDragStartRow}
      onDragEnd={onDragEndRow}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
    >
      {expandable ? (
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="flex h-5 w-5 shrink-0 items-center justify-center text-text-muted/60 hover:text-text-primary"
        >
          <Icon name={expanded ? "chevron-down" : "chevron-right"} size={11} />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      {renaming && onCommitRename && onCancelRename ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1">
          {id !== "all" && id !== "uncollected" ? (
            <Icon name="folder" size={13} className="shrink-0 text-accent/70" />
          ) : null}
          <RenameInput initialValue={label} onCommit={onCommitRename} onCancel={onCancelRename} />
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className={[
            "flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition",
            active ? "bg-accent-dim text-accent font-medium" : "text-text-secondary hover:bg-fill-2 hover:text-text-primary",
          ].join(" ")}
        >
          <span className="flex items-center gap-1.5 truncate">
            {id !== "all" && id !== "uncollected" ? (
              <Icon name={active ? "folder-open" : "folder"} size={13} className="shrink-0 text-accent/70" />
            ) : null}
            <span className="truncate">{label}</span>
          </span>
          <span className="shrink-0 rounded-full bg-fill-2 px-1.5 py-0.5 text-2xs text-text-muted tabular-nums">
            {count}
          </span>
        </button>
      )}
      {canDelete ? (
        <Button
          variant="danger"
          size="sm"
          iconOnly
          onClick={onDelete}
          aria-label={`Delete ${label}`}
          title={`Delete ${label}`}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shrink-0"
        >
          <Icon name="trash" size={12} />
        </Button>
      ) : null}
    </div>
  );
}

export function CollectionTree({
  collections,
  pages,
  currentFolderId,
  onNavigate,
  onCreateFolder,
  creatingFolder,
  onDeleteFolder,
  draggingPageIds,
  draggingFolderId,
  onDragFolderStart,
  onDragFolderEnd,
  onDropOnFolder,
  renamingFolderId,
  onCommitRename,
  onCancelRename,
  onFolderContextMenu,
}: {
  collections: CollectionRow[];
  pages: PageRow[];
  currentFolderId: CollectionFilter;
  onNavigate: (id: CollectionFilter) => void;
  onCreateFolder: (parentId: string | null, name: string) => void;
  creatingFolder: boolean;
  onDeleteFolder: (id: string) => void;
  draggingPageIds: string[] | null;
  draggingFolderId: string | null;
  onDragFolderStart: (id: string) => void;
  onDragFolderEnd: () => void;
  onDropOnFolder: (targetId: string | null) => void;
  renamingFolderId: string | null;
  onCommitRename: (id: string, name: string) => void;
  onCancelRename: () => void;
  onFolderContextMenu: (id: string, position: { x: number; y: number }) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState("");

  const topLevel = getChildren(collections, null);
  const teamSpaces = getTeamSpaces(collections);
  const canAcceptDrop = draggingPageIds !== null || draggingFolderId !== null;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // New-folder input creates inside whatever's currently open: root if
  // browsing "all"/"uncollected", else the open top-level folder itself
  // (sub-folders can't contain folders, so this is always a valid target).
  const newFolderParentId = currentFolderId === "all" || currentFolderId === "uncollected" ? null : currentFolderId;

  return (
    <aside className="rounded-xl border border-border-default bg-bg-elevated p-3 lg:sticky lg:top-16 lg:self-start">
      <div className="mb-2 px-1 text-2xs font-semibold uppercase tracking-wider text-text-muted">
        Collections
      </div>

      <div className="flex flex-col gap-0.5">
        <Row
          id="all" label="All pages" count={pageCount(pages, "all")} depth={0}
          active={currentFolderId === "all"} expandable={false} expanded={false} onToggleExpand={() => {}}
          canDelete={false} onSelect={() => onNavigate("all")} onDelete={() => {}}
          isDropTarget={draggingFolderId !== null}
          onDragOver={(e) => { if (draggingFolderId) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (draggingFolderId) onDropOnFolder(null); }}
        />
        <Row
          id="uncollected" label="Uncollected" count={pageCount(pages, "uncollected")} depth={0}
          active={currentFolderId === "uncollected"} expandable={false} expanded={false} onToggleExpand={() => {}}
          canDelete={false} onSelect={() => onNavigate("uncollected")} onDelete={() => {}}
          isDropTarget={canAcceptDrop && draggingPageIds !== null}
          onDragOver={(e) => { if (draggingPageIds) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (draggingPageIds) onDropOnFolder(null); }}
        />

        {topLevel.map((folder) => {
          const children = getChildren(collections, folder.id);
          const isExpanded = expanded.has(folder.id);
          return (
            <div key={folder.id}>
              <Row
                id={folder.id} label={folder.name} count={pageCount(pages, folder.id)} depth={0}
                active={currentFolderId === folder.id}
                expandable={children.length > 0} expanded={isExpanded} onToggleExpand={() => toggle(folder.id)}
                canDelete onSelect={() => onNavigate(folder.id)} onDelete={() => onDeleteFolder(folder.id)}
                isDropTarget={
                  draggingPageIds !== null ||
                  (draggingFolderId !== null && draggingFolderId !== folder.id &&
                    canNestInto(collections, collections.find((c) => c.id === draggingFolderId)!, folder))
                }
                onDragOver={(e) => { if (canAcceptDrop) e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggingPageIds || draggingFolderId) onDropOnFolder(folder.id);
                }}
                draggable
                onDragStartRow={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("application/x-booklet-folder", folder.id);
                  onDragFolderStart(folder.id);
                }}
                onDragEndRow={onDragFolderEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onFolderContextMenu(folder.id, { x: e.clientX, y: e.clientY });
                }}
                renaming={renamingFolderId === folder.id}
                onCommitRename={(name) => onCommitRename(folder.id, name)}
                onCancelRename={onCancelRename}
              />
              {isExpanded && children.map((child) => (
                <Row
                  key={child.id}
                  id={child.id} label={child.name} count={pageCount(pages, child.id)} depth={1}
                  active={currentFolderId === child.id}
                  expandable={false} expanded={false} onToggleExpand={() => {}}
                  canDelete onSelect={() => onNavigate(child.id)} onDelete={() => onDeleteFolder(child.id)}
                  isDropTarget={draggingPageIds !== null}
                  onDragOver={(e) => { if (draggingPageIds) e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); if (draggingPageIds) onDropOnFolder(child.id); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onFolderContextMenu(child.id, { x: e.clientX, y: e.clientY });
                  }}
                  renaming={renamingFolderId === child.id}
                  onCommitRename={(name) => onCommitRename(child.id, name)}
                  onCancelRename={onCancelRename}
                />
              ))}
            </div>
          );
        })}

        {teamSpaces.length > 0 ? (
          <>
            <div className="mt-3 mb-1 px-1 text-2xs font-semibold uppercase tracking-wider text-text-muted">
              Team spaces
            </div>
            {teamSpaces.map((team) => (
              <Row
                key={team.id}
                id={team.id} label={`${team.name} · Team`} count={pageCount(pages, team.id)} depth={0}
                active={currentFolderId === team.id}
                expandable={false} expanded={false} onToggleExpand={() => {}}
                canDelete={false} onSelect={() => onNavigate(team.id)} onDelete={() => {}}
                isDropTarget={draggingPageIds !== null}
                onDragOver={(e) => { if (draggingPageIds) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (draggingPageIds) onDropOnFolder(team.id); }}
              />
            ))}
          </>
        ) : null}
      </div>

      <div className="mt-3 flex gap-1.5">
        <input
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newFolderName.trim()) {
              onCreateFolder(newFolderParentId, newFolderName.trim());
              setNewFolderName("");
            }
          }}
          placeholder="New folder…"
          className="min-w-0 flex-1 rounded-lg border border-border-default bg-bg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
        />
        <Button
          variant="primary" size="md" iconOnly
          onClick={() => { if (newFolderName.trim()) { onCreateFolder(newFolderParentId, newFolderName.trim()); setNewFolderName(""); } }}
          disabled={creatingFolder || !newFolderName.trim()}
          aria-label="Create folder" title="Create folder"
        >
          <Icon name={creatingFolder ? "spinner" : "plus"} size={13} className={creatingFolder ? "animate-spin" : undefined} />
        </Button>
      </div>
    </aside>
  );
}
