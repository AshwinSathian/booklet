/**
 * Collection/team-space ownership service functions — extracted from the
 * "load collection, 404 if missing, 403 if not owned" check duplicated 12
 * times across collections/[id]/route.ts, collections/[id]/pages/route.ts
 * (previously its own local requireOwnedCollection helper),
 * collections/[id]/members/route.ts, teams/[id]/route.ts,
 * teams/[id]/members/route.ts, and teams/[id]/invite/route.ts. Team routes
 * additionally require is_team_space — see getOwnedTeamSpace.
 */

import { getCollectionChildren, getCollectionRecord } from "@/lib/db";
import type { DbCollection } from "@/lib/db/types";
import { ServiceError } from "./errors";

export async function getOwnedCollection(id: string, userId: string): Promise<DbCollection> {
  const collection = await getCollectionRecord(id);
  if (!collection) throw new ServiceError("NOT_FOUND", "Not found", 404);
  if (collection.user_id !== userId) throw new ServiceError("FORBIDDEN", "Forbidden", 403);
  return collection;
}

/** Like getOwnedCollection, but 404s if the collection isn't a team space. */
export async function getOwnedTeamSpace(id: string, userId: string): Promise<DbCollection> {
  const collection = await getCollectionRecord(id);
  if (!collection || !collection.is_team_space) throw new ServiceError("NOT_FOUND", "Not found", 404);
  if (collection.user_id !== userId) throw new ServiceError("FORBIDDEN", "Forbidden", 403);
  return collection;
}

/**
 * Validates a candidate `parent_id` for create/move. Returns null for a
 * top-level collection (no validation needed); otherwise returns the
 * resolved parent record, or throws a ServiceError describing exactly which
 * nesting invariant would be violated. This is the single source of truth
 * for "can X become a child of Y" — both POST /api/collections and
 * PATCH /api/collections/[id] call it.
 */
export async function resolveParent(parentId: string | null, userId: string): Promise<DbCollection | null> {
  if (parentId === null) return null;
  const parent = await getCollectionRecord(parentId);
  if (!parent || parent.user_id !== userId) {
    throw new ServiceError("NOT_FOUND", "Parent folder not found", 404);
  }
  if (parent.is_team_space) {
    throw new ServiceError("INVALID_PARENT", "Team spaces can't contain sub-folders", 422);
  }
  if (parent.parent_id !== null) {
    throw new ServiceError("INVALID_PARENT", "Sub-folders can't contain folders", 422);
  }
  return parent;
}

/** Throws if `collectionId` has any children — i.e. it can't become a sub-folder itself (would make a 3rd level). */
export async function assertCanNest(collectionId: string): Promise<void> {
  const children = await getCollectionChildren(collectionId);
  if (children.length > 0) {
    throw new ServiceError("HAS_CHILDREN", "This folder contains sub-folders and can't be nested itself", 422);
  }
}
