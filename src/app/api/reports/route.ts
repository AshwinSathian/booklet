import { z } from "zod";
import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { countOpenReportsForPage, createReport } from "@/lib/db/reports";
import { REPORT_REASONS } from "@/lib/db/types";
import { sendAbuseReportEmail } from "@/lib/email";
import { logError, logWarn } from "@/lib/logger";
import { checkMonthlyQuota, checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { getSiteOrigin } from "@/lib/site-url";
import { resolvePageId } from "@/server/page-gone";

export const runtime = "nodejs";

const MAX_OPEN_REPORTS_PER_PAGE = 10;
const MAX_REPORT_EMAILS_PER_MONTH = 200;

const ReportSchema = z.object({
  /** Page id or custom slug, as it appears in the /p/ URL. */
  page_id: z.string().trim().min(1).max(80),
  reason: z.enum(REPORT_REASONS),
  detail: z.string().trim().max(2000).optional(),
  reporter_email: z.union([z.literal(""), z.email().max(254)]).optional(),
});

/** Anyone can report a page — no account. 5 a minute per IP. */
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rl = await checkRateLimit(`report__ip__${getClientIp(req.headers)}`, 5);
    if (rl) return rl;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = ReportSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid report. Choose a reason; detail is at most 2,000 characters." }, { status: 400 });
    }

    const pageId = await resolvePageId(parsed.data.page_id);
    if (!pageId) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // One page needs one decision, not a queue of duplicates: past 10 open
    // reports, further ones are acknowledged and dropped. The count also
    // decides the email — only a page's first open report sends one, so a
    // script reporting one page in a loop cannot spend the Resend quota
    // that password-reset mail depends on.
    const alreadyOpen = await countOpenReportsForPage(pageId);
    if (alreadyOpen >= MAX_OPEN_REPORTS_PER_PAGE) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    const report = await createReport({
      page_id: pageId,
      reason: parsed.data.reason,
      detail: parsed.data.detail || null,
      reporter_email: parsed.data.reporter_email || null,
    });

    // The stored row is the record; the email is a nudge. A mail failure
    // must not turn a saved report into an error for the reporter.
    const origin = getSiteOrigin(req);
    // Second cap, across pages: at most 200 report emails a month. Beyond
    // it reports are still stored and shown in /admin/reports.
    const overEmailBudget =
      alreadyOpen > 0 ||
      (await checkMonthlyQuota("report_email", MAX_REPORT_EMAILS_PER_MONTH, "").catch(() => null)) !== null;
    if (overEmailBudget) return NextResponse.json({ ok: true }, { status: 201 });

    void sendAbuseReportEmail({
      pageUrl: `${origin}/p/${pageId}`,
      adminUrl: `${origin}/admin/reports`,
      reason: report.reason,
      detail: report.detail,
      reporterEmail: report.reporter_email,
    })
      .then((sent) => {
        if (!sent) logWarn("reports", "Abuse report stored but not emailed: ABUSE_REPORT_EMAIL or RESEND_API_KEY is unset");
      })
      .catch((err) => logError("reports", "Abuse report email failed", err));

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    logError("reports", "Unhandled error", e);
    return NextResponse.json({ error: "Could not submit the report. Try again." }, { status: 500 });
  }
}
