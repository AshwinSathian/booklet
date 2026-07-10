import { getAdminMetrics } from "@/lib/db/admin-metrics";

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
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-muted">{title}</h2>
      <table className="w-full border-collapse">
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

export default async function AdminPage() {
  let m;
  try {
    m = await getAdminMetrics();
  } catch (err) {
    console.error("[admin] failed to load metrics:", err);
    return (
      <div className="min-h-screen bg-bg p-12 text-text-primary">
        <h1 className="text-xl font-bold mb-4">Admin — Error</h1>
        <p className="text-sm text-red-400">Something went wrong loading metrics.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-10 text-text-primary max-w-2xl">
      <div className="mb-8 flex items-baseline gap-4">
        <h1 className="text-xl font-bold">Readable — Internal Metrics</h1>
        <span className="text-xs text-text-muted">{new Date().toUTCString()}</span>
      </div>

      <Section title="Publish funnel — last 7 days">
        <Row label="New pages published" value={m.weeklyNewPages} />
        <Row label="In-place updates" value={m.weeklyUpdates} />
        <Row label="Anonymous publish share" value={`${m.anonymousPublishPct}%`} sub="publishes with no user_id" />
        <Row label="API / CLI publish share" value={`${m.apiPublishPct}%`} sub="non-browser origin" />
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

      <p className="mt-8 text-2xs text-text-muted">
        IP-restricted. Not indexed. Refresh for latest numbers.
      </p>
    </div>
  );
}
