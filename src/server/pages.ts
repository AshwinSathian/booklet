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

import { getPageBySlug, getPageRecord } from "@/lib/db";
import type { DbPage } from "@/lib/db/types";
import { isValidSlug, SLUG_RULES_MESSAGE } from "@/lib/slug";
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
