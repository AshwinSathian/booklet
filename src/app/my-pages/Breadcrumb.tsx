"use client";

import { getBreadcrumbPath } from "@/lib/collections-tree";
import type { CollectionRow, CollectionFilter } from "./MyPagesClient";

export function Breadcrumb({
  collections,
  currentFolderId,
  onNavigate,
}: {
  collections: CollectionRow[];
  currentFolderId: CollectionFilter;
  onNavigate: (id: CollectionFilter) => void;
}) {
  if (currentFolderId === "all" || currentFolderId === "uncollected") {
    return (
      <div className="flex items-center gap-1.5 text-sm text-text-secondary">
        <span className="font-medium text-text-primary">
          {currentFolderId === "all" ? "All pages" : "Uncollected"}
        </span>
      </div>
    );
  }

  const path = getBreadcrumbPath(collections, currentFolderId);

  return (
    <div className="flex items-center gap-1.5 text-sm text-text-secondary">
      <button type="button" onClick={() => onNavigate("all")} className="transition hover:text-text-primary">
        All pages
      </button>
      {path.map((folder, i) => (
        <span key={folder.id} className="flex items-center gap-1.5">
          <span className="text-text-muted/40" aria-hidden>/</span>
          {i === path.length - 1 ? (
            <span className="font-medium text-text-primary">{folder.name}</span>
          ) : (
            <button type="button" onClick={() => onNavigate(folder.id)} className="transition hover:text-text-primary">
              {folder.name}
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
