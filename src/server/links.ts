/**
 * `[[Title]]` in a published page. In a draft it links the author's own
 * drafts (src/lib/wikilinks). At publish, a title that matches a published
 * page becomes a real link and a `page_links` row; every other wikilink is
 * turned to plain text, as all of them were before.
 */

import type { Block } from "@/lib/blocks";
import { findLinkTargets, getCollectionRecord } from "@/lib/db";
import type { DbPage } from "@/lib/db/types";
import { ROUTES } from "@/lib/constants";
import { normalizeTitleKey } from "@/lib/wikilinks/resolve";
import { stripWikilinksFromBlocks } from "@/lib/wikilinks/strip";

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
 * ponytail: decided when the source is published. Changing either page's
 * visibility later leaves the link as it was until the source is published
 * again.
 */
function mayLink(source: DbPage["visibility"], target: DbPage["visibility"]): boolean {
  if (target === "public") return true;
  if (source === "public") return false;
  return target !== "team" || source === "team";
}

async function isTeamSpace(collectionId: string | null): Promise<boolean> {
  return collectionId ? ((await getCollectionRecord(collectionId))?.is_team_space ?? false) : false;
}

/**
 * Returns `blocks` with every wikilink replaced, and the ids of the pages
 * the resolved ones point at. A page in a team space links to that space's
 * pages; any other page links to its author's pages that are in no space.
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

  const inSpace = await isTeamSpace(source.collectionId);
  const candidates = await findLinkTargets(
    inSpace ? { spaceId: source.collectionId as string } : { userId: source.userId },
    [...wanted.values()],
  );

  const byTitle = new Map<string, DbPage>();
  for (const page of candidates) {
    const key = normalizeTitleKey(page.title ?? "");
    if (page.id === source.id || byTitle.has(key) || !mayLink(source.visibility, page.visibility)) continue;
    // Outside a space, the author's pages that sit in some team space are
    // that team's, not part of this page's neighbourhood.
    if (!inSpace && (await isTeamSpace(page.collection_id))) continue;
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
