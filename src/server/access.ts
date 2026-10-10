/**
 * Who may read a page and who may put pages in a team space. Every surface
 * that shows a page's content, title or existence in a listing asks here.
 */

import { getCollectionBySlug, getCollectionMember, getCollectionRecord } from "@/lib/db";
import type { CollectionMemberRole, DbCollection, DbPage } from "@/lib/db/types";
import { ServiceError } from "./errors";

export type SpaceRole = "owner" | CollectionMemberRole;

/** The caller's role in a team space, or null: not a member, or not a team space. */
export async function spaceRole(space: DbCollection | null, userId: string | null): Promise<SpaceRole | null> {
  if (!space?.is_team_space || !userId) return null;
  if (space.user_id === userId) return "owner";
  return (await getCollectionMember(space.id, userId))?.role ?? null;
}

/**
 * Only `team` visibility restricts who may open a page: its owner, and the
 * owner and members of the team space it is in. A team-only page whose
 * space is gone, or is no longer a team space, is readable by its owner
 * alone. Anything else (no record, public, unlisted) is open to whoever has
 * the link, and the caller's other gates (password, takedown) still apply.
 */
export async function canViewPage(
  page: Pick<DbPage, "visibility" | "user_id" | "collection_id"> | null,
  userId: string | null,
): Promise<boolean> {
  if (page?.visibility !== "team") return true;
  if (!userId) return false;
  if (page.user_id === userId) return true;
  if (!page.collection_id) return false;
  return (await spaceRole(await getCollectionRecord(page.collection_id), userId)) !== null;
}

/**
 * Whether a page may be named to this viewer in a list drawn from other
 * pages ("Referenced by"). Narrower than canViewPage: an unlisted page is
 * readable by link, and listing it would hand out the link.
 */
export async function canListPage(page: DbPage, userId: string | null): Promise<boolean> {
  if (page.taken_down_at) return false;
  if (userId && page.user_id === userId) return true;
  if (page.visibility === "public" && !page.password_hash) return true;
  if (!userId || !page.collection_id) return false;
  return (await spaceRole(await getCollectionRecord(page.collection_id), userId)) !== null;
}

/** 404, never 403, for a space the caller is not in: a team's slug is not theirs to confirm. */
const SPACE_NOT_FOUND = () => new ServiceError("SPACE_NOT_FOUND", "Team space not found.", 404);

async function asMember(space: DbCollection | null, userId: string): Promise<{ space: DbCollection; role: SpaceRole }> {
  const role = await spaceRole(space, userId);
  if (!space || !role) throw SPACE_NOT_FOUND();
  return { space, role };
}

/** The team space with this slug, if the caller owns it or is a member. */
export async function getSpaceForMember(slug: unknown, userId: string): Promise<DbCollection> {
  if (typeof slug !== "string" || !slug.trim()) throw SPACE_NOT_FOUND();
  return (await asMember(await getCollectionBySlug(slug.trim().toLowerCase()), userId)).space;
}

/** The team space a page is about to be put in. Viewers may read a space and not add to it. */
export async function getWritableSpace(ref: { slug: unknown } | { id: unknown }, userId: string): Promise<DbCollection> {
  const key = "slug" in ref ? ref.slug : ref.id;
  if (typeof key !== "string" || !key.trim()) throw SPACE_NOT_FOUND();
  const found = "slug" in ref ? await getCollectionBySlug(key.trim().toLowerCase()) : await getCollectionRecord(key.trim());
  const { space, role } = await asMember(found, userId);
  if (role === "viewer") {
    throw new ServiceError("FORBIDDEN", "You can read this team space but not publish to it.", 403);
  }
  return space;
}

/**
 * `team` visibility only means something for a page in a team space, and
 * only a current member of that space may set it. A page stays in a space
 * after its owner is removed from it; that page must not become a
 * team-only one, which may link to the space's other team-only pages.
 */
export async function assertVisibilityAllowed(visibility: unknown, collectionId: string | null, userId: string): Promise<void> {
  if (visibility !== "team") return;
  if (!collectionId || !(await spaceRole(await getCollectionRecord(collectionId), userId))) {
    throw new ServiceError(
      "TEAM_VISIBILITY_NEEDS_SPACE",
      "visibility 'team' is only for a page in a team space. Publish it with `space`, or move it into a space first.",
      422,
    );
  }
}
