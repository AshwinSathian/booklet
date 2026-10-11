/**
 * `[[Title]]` in a published page. In a draft it links the author's own
 * drafts (src/lib/wikilinks). At publish, a title that matches a published
 * page becomes a real link and a `page_links` row; every other wikilink is
 * turned to plain text, as all of them were before.
 */

import type { Block } from "@/lib/blocks";
import { findLinkTargets, getCollectionRecord, getCollectionsByIds } from "@/lib/db";
import type { DbCollection, DbPage } from "@/lib/db/types";
import { ROUTES } from "@/lib/constants";
import { normalizeTitleKey } from "@/lib/wikilinks/resolve";
import { stripWikilinksFromBlocks } from "@/lib/wikilinks/strip";
import { spaceRole } from "./access";

/** The page being published. `userId` null is an anonymous publish, which resolves nothing. */
export type LinkSource = {
  id: string;
  userId: string | null;
  collectionId: string | null;
  visibility: DbPage["visibility"];
};

const MAX_TARGETS = 200;

/**
 * A link must not point somewhere its readers cannot follow, and must not
 * publish the address of a page that was only shared by link. So a public
 * page links to public pages only, and only a team-only page links to
 * team-only pages.
 *
 * Decided when the source is published, and again when the source's
 * visibility changes (relinkPage in ./pages.ts).
 *
 * ponytail: a target that later becomes less visible keeps the links that
 * already point at it until each source is published again. Relink the
 * sources from page_links if that turns out to matter.
 */
function mayLink(source: DbPage["visibility"], target: DbPage["visibility"]): boolean {
  if (target === "public") return true;
  if (source === "public") return false;
  return target !== "team" || source === "team";
}

async function teamSpace(collectionId: string | null): Promise<DbCollection | null> {
  const collection = collectionId ? await getCollectionRecord(collectionId) : null;
  return collection?.is_team_space ? collection : null;
}

/**
 * Returns `blocks` with every wikilink replaced, and the ids of the pages
 * the resolved ones point at. A page in a team space, published by a member
 * of it, links to that space's pages; any other page links to its author's
 * pages that are in no space.
 */
export async function resolveWikilinks(
  blocks: Block[],
  source: LinkSource,
  origin: string,
): Promise<{ blocks: Block[]; targetIds: string[] }> {
  const wanted = new Map<string, string>(); // normalized title → title as written
  stripWikilinksFromBlocks(blocks, (node) => {
    if (wanted.size < MAX_TARGETS) wanted.set(normalizeTitleKey(node.target), node.target.trim());
    return node;
  });
  if (!source.userId || wanted.size === 0) return { blocks: stripWikilinksFromBlocks(blocks), targetIds: [] };

  // The author must still be in the space. A page stays where it is when its
  // owner is removed, and republishing it with guessed titles would
  // otherwise confirm the space's page titles and hand back their URLs.
  const inSpace = (await spaceRole(await teamSpace(source.collectionId), source.userId)) !== null;
  const candidates = await findLinkTargets(
    inSpace ? { spaceId: source.collectionId as string } : { userId: source.userId },
    [...wanted.values()],
  );

  // Outside a space, the author's pages that sit in some team space are
  // that team's, not part of this page's neighbourhood. One query for all
  // the candidates' collections, not one per candidate.
  const collections = inSpace
    ? new Map<string, DbCollection>()
    : await getCollectionsByIds(candidates.flatMap((p) => (p.collection_id ? [p.collection_id] : [])));
  const inSomeTeamSpace = (page: DbPage) => Boolean(page.collection_id && collections.get(page.collection_id)?.is_team_space);

  const byTitle = new Map<string, DbPage>();
  for (const page of candidates) {
    const key = normalizeTitleKey(page.title ?? "");
    if (page.id === source.id || byTitle.has(key) || !mayLink(source.visibility, page.visibility)) continue;
    if (!inSpace && inSomeTeamSpace(page)) continue;
    byTitle.set(key, page);
  }

  const targetIds = new Set<string>();
  const resolved = stripWikilinksFromBlocks(blocks, (node) => {
    const target = byTitle.get(normalizeTitleKey(node.target));
    const text = { t: "text" as const, v: node.label ?? node.target };
    if (!target) return text;
    targetIds.add(target.id);
    // By id, not slug: a slug can be changed or released, an id cannot.
    return { t: "link", href: `${origin}${ROUTES.publish(target.id)}`, c: [text] };
  });
  return { blocks: resolved, targetIds: [...targetIds] };
}
