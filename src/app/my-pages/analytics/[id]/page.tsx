import { AppPage, AppPageTitle } from "@/components/app/AppPage";
import { ROUTES } from "@/lib/constants";
import { getPageAnalytics } from "@/lib/db/analytics";
import { getPageRecord } from "@/lib/db";
import { extractDocTitle } from "@/lib/doc-title";
import { getDoc } from "@/lib/storage";
import { getSession } from "@/lib/auth/session";
import { notFound } from "next/navigation";
import { ViewsChart } from "./ViewsChart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Page analytics · Booklet",
  robots: { index: false, follow: false },
};

const REFERRER_LABELS = {
  slack: "Slack",
  twitter: "Twitter/X",
  github: "GitHub",
  email: "Email",
  direct: "Direct",
  other: "Other",
} as const;

function pctWidth(value: number, max: number): string {
  if (max <= 0 || value <= 0) return "0%";
  return `${Math.max(3, Math.round((value / max) * 100))}%`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border-default bg-bg-elevated px-5 py-4">
      <div className="font-display text-3xl font-medium tabular-nums text-text-primary">{value}</div>
      <div className="mt-1 text-xs text-text-muted">{label}</div>
    </div>
  );
}

export default async function PageAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return null;

  const { id } = await params;
  const page = await getPageRecord(id);
  if (!page || page.user_id !== userId) notFound();

  const [summary, doc] = await Promise.all([
    getPageAnalytics(id),
    getDoc(id).catch(() => null),
  ]);

  const title = page.title ?? (doc ? extractDocTitle(doc.blocks) : null) ?? "Untitled page";
  const maxDayViews = Math.max(0, ...summary.views_by_day.map((row) => row.views));
  const totalReferrers = Object.values(summary.referrers).reduce((sum, count) => sum + count, 0);
  const maxCountryViews = Math.max(0, ...summary.top_countries.map((row) => row.count));

  return (
    <AppPage width="medium">
        <AppPageTitle back={{ href: ROUTES.myPages, label: "My pages" }} eyebrow="Analytics" title={title} />

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Views" value={summary.total_views.toLocaleString()} />
          <Stat label="Unique readers" value={summary.unique_views.toLocaleString()} />
          <Stat label="Reached halfway" value={`${summary.read_50_pct}%`} />
          <Stat label="Reached the end" value={`${summary.read_100_pct}%`} />
        </section>

        <section className="mt-6 rounded-xl border border-border-default bg-bg-elevated p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Views, last 30 days</h2>
            <span className="text-xs text-text-muted">{maxDayViews.toLocaleString()} peak day</span>
          </div>
          <ViewsChart data={summary.views_by_day} />
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-border-default bg-bg-elevated p-5">
            <h2 className="mb-4 text-sm font-semibold">Referrers</h2>
            <div className="space-y-3">
              {Object.entries(summary.referrers).map(([bucket, count]) => {
                const percent = totalReferrers > 0 ? Math.round((count / totalReferrers) * 100) : 0;
                return (
                  <div key={bucket}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="text-text-secondary">{REFERRER_LABELS[bucket as keyof typeof REFERRER_LABELS]}</span>
                      <span className="tabular-nums text-text-muted">{percent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-fill-2">
                      <div className="h-2 rounded-full bg-accent" style={{ width: pctWidth(count, totalReferrers) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border-default bg-bg-elevated p-5">
            <h2 className="mb-4 text-sm font-semibold">Top countries</h2>
            {summary.top_countries.length > 0 ? (
              <div className="space-y-3">
                {summary.top_countries.map((row) => (
                  <div key={row.country}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono text-text-secondary">{row.country}</span>
                      <span className="tabular-nums text-text-muted">{row.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-fill-2">
                      <div className="h-2 rounded-full bg-accent" style={{ width: pctWidth(row.count, maxCountryViews) }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">No country data yet.</p>
            )}
          </section>
        </div>
    </AppPage>
  );
}
