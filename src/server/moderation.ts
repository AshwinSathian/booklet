/**
 * Abuse-report resolution. Called from the admin queue's server actions
 * (src/app/admin/reports/actions.ts), which do the authorization — nothing
 * here checks who is asking.
 */

import { markPageTakenDown } from "@/lib/db";
import { getReport, resolveReport, resolveReportsForPage } from "@/lib/db/reports";
import { logInfo } from "@/lib/logger";
import { markDocTakenDown } from "@/lib/storage";
import { ServiceError } from "./errors";

/**
 * Takes a page down: /p/:id, /p/:id/embed and the v1 read route answer 410
 * from then on, with no content. The document itself is kept (evidence,
 * and the owner's own export) — nothing is deleted.
 */
export async function takeDownPage(pageId: string): Promise<void> {
  const at = new Date().toISOString();
  if (!(await markDocTakenDown(pageId, at))) {
    throw new ServiceError("NOT_FOUND", "Page not found", 404);
  }
  await markPageTakenDown(pageId, at);
  await resolveReportsForPage(pageId, "actioned");
  logInfo("moderation", "Page taken down", { pageId });
}

export async function takeDownReportedPage(reportId: string): Promise<void> {
  const report = await getReport(reportId);
  if (!report) throw new ServiceError("NOT_FOUND", "Report not found", 404);
  await takeDownPage(report.page_id);
}

export async function dismissReport(reportId: string): Promise<void> {
  if (!(await resolveReport(reportId, "dismissed"))) {
    throw new ServiceError("NOT_FOUND", "Report not found or already closed", 404);
  }
}
