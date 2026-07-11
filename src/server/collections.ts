/**
 * Collection/team-space ownership service functions — extracted from the
 * "load collection, 404 if missing, 403 if not owned" check duplicated 12
 * times across collections/[id]/route.ts, collections/[id]/pages/route.ts
 * (previously its own local requireOwnedCollection helper),
 * collections/[id]/members/route.ts, teams/[id]/route.ts,
 * teams/[id]/members/route.ts, and teams/[id]/invite/route.ts. Team routes
 * additionally require is_team_space — see getOwnedTeamSpace.
 */

import { getCollectionRecord } from "@/lib/db";
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
