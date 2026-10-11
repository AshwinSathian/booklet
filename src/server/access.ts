/**
 * Who may read a page and who may put pages in a team space. Every surface
 * that shows a page's content, title or existence in a listing asks here.
 */

import { getCollectionBySlug, getCollectionMember, getCollectionRecord, getCollectionsByIds, getMemberCollectionIds } from "@/lib/db";
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
  return (await listablePages([page], userId)).length === 1;
}

/**
 * The pages among `pages` that may be named to this viewer, in the same
 * order. This is the rule; canListPage is it for one page. Two queries
 * however many pages there are: the spaces involved, and the viewer's
 * memberships in them.
 */
export async function listablePages(pages: DbPage[], userId: string | null): Promise<DbPage[]> {
  const open = (p: DbPage) => (userId !== null && p.user_id === userId) || (p.visibility === "public" && !p.password_hash);
  const candidates = pages.filter((p) => !p.taken_down_at);
  // Only a page that is neither the viewer's nor public needs its space looked at.
  const spaceIds = userId ? [...new Set(candidates.filter((p) => !open(p) && p.collection_id).map((p) => p.collection_id as string))] : [];
  const readable = new Set<string>();
  if (userId && spaceIds.length) {
    const spaces = await getCollectionsByIds(spaceIds);
    const memberOf = await getMemberCollectionIds(spaceIds, userId);
    for (const [id, space] of spaces) {
      if (space.is_team_space && (space.user_id === userId || memberOf.has(id))) readable.add(id);
    }
  }
  return candidates.filter((p) => open(p) || (p.collection_id !== null && readable.has(p.collection_id)));
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
