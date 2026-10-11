import { getAdminMetrics } from "@/lib/db/admin-metrics";
import { countOpenReports } from "@/lib/db/reports";
import { listErrorEvents } from "@/lib/db/error-events";
import { logError } from "@/lib/logger";
import { AppPage, AppPageTitle } from "@/components/app/AppPage";
import { Button } from "@/components/ui/Button";
import { notFound } from "next/navigation";
import { isAdminRequest } from "@/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Admin metrics dashboard — IP-restricted (see middleware.ts)
// ---------------------------------------------------------------------------

function Row({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <tr className="border-b border-border-subtle last:border-0">
      <td className="py-2 pr-8 text-sm text-text-secondary">{label}</td>
      <td className="py-2 text-sm font-semibold text-text-primary tabular-nums">{value}</td>
      {sub && <td className="py-2 pl-4 text-xs text-text-muted">{sub}</td>}
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">{title}</h2>
      <table className="w-full border-collapse">
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

export default async function AdminPage() {
  // Checked here as well as in layout.tsx: a layout and its page render in
  // parallel, so a layout-only notFound() sets the 404 status while this
  // page's data still streams into the response body.
  if (!(await isAdminRequest())) notFound();

  let m;
  let openReports;
  let errors;
  try {
    [m, openReports, errors] = await Promise.all([getAdminMetrics(), countOpenReports(), listErrorEvents()]);
  } catch (err) {
    logError("admin", "Failed to load metrics", err);
    return (
      <AppPage width="medium">
        <AppPageTitle eyebrow="Admin" title="Admin — Error" />
        <p className="text-sm text-danger">Something went wrong loading metrics.</p>
      </AppPage>
    );
  }

  return (
    <AppPage width="medium">
      <AppPageTitle
        eyebrow="Admin"
        title="Booklet — Internal Metrics"
        lede={new Date().toUTCString()}
        action={
          <Button variant="secondary" size="lg" href="/admin/reports">
            Abuse reports ({openReports} open)
          </Button>
        }
      />

      <Section title="Publish funnel — last 7 days">
        <Row label="New pages published" value={m.weeklyNewPages} />
        <Row label="In-place updates" value={m.weeklyUpdates} />
        <Row label="Anonymous publish share" value={`${m.anonymousPublishPct}%`} sub="publishes with no user_id" />
      </Section>

      <Section title="Publish source — last 7 days">
        {m.sourceBreakdown.length === 0 ? (
          <tr>
            <td className="py-2 text-sm text-text-muted">No data yet</td>
          </tr>
        ) : (
          m.sourceBreakdown.map((s) => (
            <Row key={s.source} label={s.source} value={`${s.pct}%`} sub={`${s.count} publishes`} />
          ))
        )}
      </Section>

      <Section title="Retention — last 30 days">
        <Row
          label="Re-publish rate"
          value={`${m.monthlyRepublishRate}%`}
          sub="signed-in users who published ≥ 2 times"
        />
      </Section>

      <Section title="Share page funnel — last 7 days">
        <Row label="Total share page views" value={m.weeklyShareViews.toLocaleString()} />
        <Row label="'Make your own' CTR" value={`${m.ctaClickRate}%`} sub="cta_click / view" />
        <Row label="Read completion rate" value={`${m.readCompletionRate}%`} sub="read_100 / view" />
      </Section>

      <Section title="Referrer breakdown — last 7 days">
        {m.topReferrers.length === 0 ? (
          <tr>
            <td className="py-2 text-sm text-text-muted">No data yet</td>
          </tr>
        ) : (
          m.topReferrers.map((r) => (
            <Row key={r.bucket} label={r.bucket} value={r.count.toLocaleString()} />
          ))
        )}
      </Section>

      <Section title="All-time totals">
        <Row label="Total pages published (events)" value={m.totalPagesPublished.toLocaleString()} />
        <Row label="Owned pages (DB records)" value={m.totalPagesOwned.toLocaleString()} />
      </Section>

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
          Errors — last seen in the past 30 days
        </h2>
        {errors.length === 0 ? (
          <p className="py-2 text-sm text-text-muted">None logged.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {errors.map((e) => (
              <li key={e._id} className="py-2.5">
                <details>
                  <summary className="cursor-pointer text-sm text-text-primary">
                    <span className="font-mono text-xs text-text-muted">{e.scope}</span> {e.message}
                    <span className="ml-2 text-xs text-text-muted tabular-nums">
                      ×{e.count} · last {e.last_seen.toISOString().replace("T", " ").slice(0, 16)} UTC
                    </span>
                  </summary>
                  <pre tabIndex={0} className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-bg-elevated p-3 text-xs text-text-secondary">
                    {[e.error_message, e.stack, `First seen ${e.first_seen.toISOString()}`].filter(Boolean).join("\n\n")}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-xs text-text-muted">
        IP-restricted. Not indexed. Refresh for latest numbers.
      </p>
    </AppPage>
  );
}
