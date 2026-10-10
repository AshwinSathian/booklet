import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminRequest } from "@/server/admin";
import { listOpenReports } from "@/lib/db/reports";
import { dismissAction, takeDownAction } from "./actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Open abuse reports. Gated by src/app/admin/layout.tsx (session +
// ADMIN_USER_IDS) and the /admin IP allowlist in src/middleware.ts.

export default async function AdminReportsPage() {
  // Checked here as well as in layout.tsx: a layout and its page render in
  // parallel, so a layout-only notFound() sets the 404 status while this
  // page's data still streams into the response body.
  if (!(await isAdminRequest())) notFound();

  const reports = await listOpenReports();

  return (
    <div className="min-h-screen bg-bg p-10 text-text-primary max-w-3xl">
      <div className="mb-8 flex items-baseline gap-4">
        <h1 className="text-xl font-bold font-display">Abuse reports</h1>
        <span className="text-xs text-text-muted">{reports.length} open</span>
        <Link href="/admin" className="ml-auto text-xs text-accent hover:underline">
          Metrics
        </Link>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-text-secondary">No open reports.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {reports.map((r) => (
            <li key={r.id} data-testid="report" className="rounded-card border border-border-default p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-semibold">{r.reason}</span>
                <a
                  href={`/p/${r.page_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-accent hover:underline"
                >
                  /p/{r.page_id}
                </a>
                <span className="text-xs text-text-muted">{new Date(r.created_at).toUTCString()}</span>
              </div>
              {r.detail ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-secondary">{r.detail}</p>
              ) : null}
              {r.reporter_email ? (
                <p className="mt-2 text-xs text-text-muted">Reporter: {r.reporter_email}</p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <form action={takeDownAction}>
                  <input type="hidden" name="reportId" value={r.id} />
                  <button
                    type="submit"
                    className="rounded-pill bg-red-500/15 px-3.5 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/25"
                  >
                    Take down
                  </button>
                </form>
                <form action={dismissAction}>
                  <input type="hidden" name="reportId" value={r.id} />
                  <button
                    type="submit"
                    className="rounded-pill border border-border-default px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:text-text-primary"
                  >
                    Dismiss
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
