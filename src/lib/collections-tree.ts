/**
 * Pure helpers for deriving Finder-style tree/browsing structure from the
 * flat collections array the client already fetches from GET
 * /api/collections. No fetches here — everything is a filter/sort over
 * data the caller already has, which is what keeps nesting a client-side
 * reinterpretation rather than a new data-fetching layer.
 */

export type TreeCollection = {
  id: string;
  name: string;
  is_team_space: boolean;
  parent_id: string | null;
};

/** Top-level ("all") or a specific sub-folder's direct children, excluding team spaces. */
export function getChildren<T extends TreeCollection>(collections: T[], parentId: string | null): T[] {
  return collections
    .filter((c) => c.parent_id === parentId && !c.is_team_space)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getTeamSpaces<T extends TreeCollection>(collections: T[]): T[] {
  return collections.filter((c) => c.is_team_space).sort((a, b) => a.name.localeCompare(b.name));
}

/** Root-to-leaf path for breadcrumbs. [] for the root itself (id === null). */
export function getBreadcrumbPath<T extends TreeCollection>(collections: T[], id: string | null): T[] {
  const byId = new Map(collections.map((c) => [c.id, c]));
  const path: T[] = [];
  let current = id;
  while (current !== null) {
    const node = byId.get(current);
    if (!node) break;
    path.unshift(node);
    current = node.parent_id;
  }
  return path;
}

export function hasChildren<T extends TreeCollection>(collections: T[], id: string): boolean {
  return collections.some((c) => c.parent_id === id);
}

/**
 * Mirrors the server's resolveParent/assertCanNest invariants (see
 * src/server/collections.ts) so the UI only ever offers valid drop
 * targets — the server still re-validates on the actual PATCH, this is
 * purely so dragging a folder over an invalid target never lights up.
 */
export function canNestInto<T extends TreeCollection>(collections: T[], dragged: T, target: T): boolean {
  if (dragged.id === target.id) return false;
  if (dragged.is_team_space || target.is_team_space) return false;
  if (target.parent_id !== null) return false;
  if (dragged.parent_id === target.id) return false;
  if (hasChildren(collections, dragged.id)) return false;
  return true;
}
