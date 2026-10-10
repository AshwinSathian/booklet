/**
 * Page ownership + slug-validation service functions — extracted from
 * near-identical inline logic that was previously duplicated across
 * src/app/api/pages/[id]/route.ts, publish/[id]/route.ts,
 * v1/pages/[id]/route.ts, pages/[id]/versions/route.ts, and
 * pages/[id]/versions/[versionNumber]/route.ts (9 occurrences of the same
 * "load page, 404 if missing, 403 if not owned" check; 4 occurrences of the
 * same slug-format + collision check). Content-patch/publish logic is
 * deliberately NOT unified here — see PLAN-backend-auth-migration.md
 * Phase 2 notes: the web PATCH /api/pages/[id] (metadata-only),
 * /api/publish/[id] (content-only), and the v1 API's combined PATCH have
 * genuinely different contracts (e.g. only pages/[id] supports setting a
 * page password), and forcing them through one function risks silently
 * changing behavior for comparatively little benefit.
 */

import { createHash } from "node:crypto";
import type { Block } from "@/lib/blocks";
import { validateBlocks } from "@/lib/block-schema";
import { getCollectionRecord, getPageBySlug, getPageRecord, setPageLinks } from "@/lib/db";
import { getDoc, putDoc } from "@/lib/storage";
import type { DbPage } from "@/lib/db/types";
import { docTypeOf } from "@/lib/doc-types";
import { extractDocTitle } from "@/lib/doc-title";
import { parseFrontmatter, type FrontmatterMeta } from "@/lib/frontmatter";
import { logError } from "@/lib/logger";
import { parseToBlocks } from "@/lib/parse";
import { resolveWikilinks, type LinkSource } from "./links";
import { isValidSlug, SLUG_RULES_MESSAGE } from "@/lib/slug";
import { STORAGE } from "@/lib/constants";
import { GONE_MESSAGES } from "@/lib/gone-notice";
import { ServiceError } from "./errors";

export async function getOwnedPage(id: string, userId: string): Promise<DbPage> {
  const record = await getPageRecord(id);
  if (!record) throw new ServiceError("NOT_FOUND", "Page not found", 404);
  if (record.user_id !== userId) throw new ServiceError("FORBIDDEN", "Forbidden", 403);
  return record;
}

/** Like getOwnedPage, but also accepts a custom slug in place of the page id (v1 API). */
export async function getOwnedPageByIdOrSlug(idOrSlug: string, userId: string): Promise<DbPage> {
  const record = (await getPageRecord(idOrSlug)) ?? (await getPageBySlug(idOrSlug));
  if (!record) throw new ServiceError("NOT_FOUND", "Page not found", 404);
  if (record.user_id !== userId) throw new ServiceError("FORBIDDEN", "Forbidden", 403);
  return record;
}

/** Validates slug format and checks it isn't already taken by a different page. */
export async function assertSlugAvailable(slug: string, excludePageId: string | null): Promise<void> {
  if (!isValidSlug(slug)) {
    throw new ServiceError("INVALID_SLUG", `Invalid slug. ${SLUG_RULES_MESSAGE}`, 422);
  }
  const existing = await getPageBySlug(slug);
  if (existing && existing.id !== excludePageId) {
    throw new ServiceError("SLUG_TAKEN", "Slug is already taken.", 409);
  }
}

/**
 * The one document size limit, shared by all four publish/update routes.
 * Rejects instead of truncating: these routes used to store
 * `raw.slice(0, maxInputChars)` beside blocks parsed from the whole input, so
 * an oversized document published with a silently shortened source.
 */
export function assertRawWithinLimit(raw: string): void {
  if (raw.length > STORAGE.maxInputChars) {
    throw new ServiceError(
      "DOCUMENT_TOO_LARGE",
      `Document is too large. The limit is ${STORAGE.maxInputChars.toLocaleString("en-US")} characters; this one has ${raw.length.toLocaleString("en-US")}.`,
      413,
      { limit: "characters", max: STORAGE.maxInputChars, actual: raw.length },
    );
  }
}

/**
 * The second size limit: the stored form (`{blocks, raw}` as JSON) must fit
 * in STORAGE.maxDocBytes. A document under the character limit can still
 * exceed it when it is dense with small blocks, so the response says which
 * of the two limits was hit.
 */
export function assertStoredWithinLimit(blocks: unknown, raw: string): void {
  const actual = new TextEncoder().encode(JSON.stringify({ blocks, raw })).byteLength;
  if (actual > STORAGE.maxDocBytes) {
    throw new ServiceError(
      "DOCUMENT_TOO_LARGE",
      `Document is too large once parsed. Its stored form is ${actual.toLocaleString("en-US")} bytes and the limit is ${STORAGE.maxDocBytes.toLocaleString("en-US")}. Documents with many small blocks reach this before the ${STORAGE.maxInputChars.toLocaleString("en-US")}-character limit.`,
      413,
      { limit: "stored_bytes", max: STORAGE.maxDocBytes, actual },
    );
  }
}

/** Collection id → team space slug, for the pages that are in a team space. */
export async function spaceSlugs(pages: Array<Pick<DbPage, "collection_id">>): Promise<Map<string, string>> {
  const slugs = new Map<string, string>();
  for (const id of new Set(pages.map((p) => p.collection_id))) {
    const slug = id ? (await getCollectionRecord(id))?.slug : null;
    if (id && slug) slugs.set(id, slug);
  }
  return slugs;
}

export type BuiltDocument = {
  fm: FrontmatterMeta;
  blocks: Block[];
  /** Pages this one links to through `[[Title]]`; store with setPageLinks after the document. */
  linkTargetIds: string[];
  /** What the `pages` record takes from the document. */
  record: Pick<DbPage, "title" | "doc_type" | "frontmatter_meta">;
};

/**
 * Turns submitted Markdown into what gets stored, for all four publish and
 * update routes: both size limits, frontmatter, blocks derived on the
 * server (never accepted from a client, see src/lib/block-schema.ts), and
 * wikilinks resolved or turned to text. Throws a ServiceError the route
 * hands to toErrorResponse.
 *
 * `raw` is stored whole, frontmatter included, so the editor, the API and
 * the Markdown export all give back what was published.
 */
export async function buildDocument(raw: string, source: LinkSource, origin: string): Promise<BuiltDocument> {
  assertRawWithinLimit(raw);
  const { meta: fm, body } = parseFrontmatter(raw);
  const { blocks, targetIds } = await resolveWikilinks(parseToBlocks(body), source, origin);
  if (!blocks.length) {
    throw new ServiceError("EMPTY_DOCUMENT", "Nothing to publish — the document is empty.", 400);
  }
  // A check on the parser's own output, not a client trust boundary.
  const blocksError = validateBlocks(blocks);
  if (blocksError) {
    logError("buildDocument", "Parser produced an invalid block shape", new Error(blocksError));
    throw new ServiceError("PARSE_FAILED", "Failed to parse document. Please report this.", 500);
  }
  assertStoredWithinLimit(blocks, raw);
  return { fm, blocks, linkTargetIds: targetIds, record: recordFields(fm, blocks) };
}

/** What a `pages` record takes from a document's frontmatter and blocks. */
export function recordFields(fm: FrontmatterMeta, blocks: Block[]): BuiltDocument["record"] {
  return {
    title: fm.title ?? extractDocTitle(blocks),
    doc_type: docTypeOf(fm),
    frontmatter_meta: Object.keys(fm).length > 0 ? (fm as Record<string, unknown>) : null,
  };
}

/**
 * Resolves a page's `[[Title]]` links again from its stored Markdown, as if
 * it were being published with `visibility`. Which links a page may carry
 * depends on its visibility (see mayLink in ./links.ts), so a page that
 * becomes public must lose its links to pages that are not. Does nothing
 * for a page stored without its Markdown.
 */
export async function relinkPage(page: DbPage, visibility: DbPage["visibility"], origin: string): Promise<void> {
  const doc = await getDoc(page.id);
  if (!doc?.raw) return;
  const built = await buildDocument(
    doc.raw,
    { id: page.id, userId: page.user_id, collectionId: page.collection_id, visibility },
    origin,
  );
  await putDoc(page.id, { ...doc, blocks: built.blocks });
  await setPageLinks(page.id, built.linkTargetIds);
}

/**
 * A taken-down page is frozen: its owner can neither change nor delete it.
 * Otherwise setting visibility back to "public" would put its title and
 * tags back on Explore and in the sitemap, and releasing or deleting its
 * slug would let a fresh copy take over the URL that was taken down.
 */
export function assertNotTakenDown(page: DbPage): void {
  if (page.taken_down_at) {
    throw new ServiceError("TAKEN_DOWN", GONE_MESSAGES.taken_down, 410);
  }
}

/**
 * Entity tag for a page as the v1 API returns it. Covers what a write can
 * change (content through `updated_at`, slug, visibility, title) and leaves
 * out `view_count`, which changes on every read.
 */
export function pageEtag(page: Pick<DbPage, "updated_at" | "slug" | "visibility" | "title">): string {
  const hash = createHash("sha256")
    .update(JSON.stringify([page.updated_at, page.slug ?? null, page.visibility, page.title ?? null]))
    .digest("hex");
  return `"${hash.slice(0, 32)}"`;
}

function etagList(header: string): string[] {
  return header.split(",").map((t) => t.trim().replace(/^W\//, ""));
}

/** True when `If-None-Match` names the page's current tag (answer 304). */
export function ifNoneMatchHits(req: Request, page: DbPage): boolean {
  const header = req.headers.get("if-none-match");
  return header !== null && (header.trim() === "*" || etagList(header).includes(pageEtag(page)));
}

/**
 * Honors `If-Match` on a write: throws 412 when the caller's tag is stale.
 * No header means no precondition.
 *
 * ponytail: check-then-write, so two writers holding the same fresh tag can
 * both pass. Fold the tag into the update filter if lost updates show up.
 */
export function assertIfMatch(req: Request, page: DbPage): void {
  const header = req.headers.get("if-match");
  if (header === null || header.trim() === "*") return;
  if (!etagList(header).includes(pageEtag(page))) {
    throw new ServiceError(
      "PRECONDITION_FAILED",
      "The page changed since you read it. Fetch it again and retry with the new ETag.",
      412,
    );
  }
}
