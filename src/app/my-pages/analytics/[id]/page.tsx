import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";
import { getPageAnalytics } from "@/lib/db/analytics";
import { getPageRecord } from "@/lib/db";
import { extractDocTitle } from "@/lib/doc-title";
import { getDoc } from "@/lib/storage";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Page analytics — Readable",
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
    <div className="border border-outline bg-bg-elevated px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums text-text-primary">{value}</div>
      <div className="mt-1 text-xs text-text-muted">{label}</div>
    </div>
  );
}

export default async function PageAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
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
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-12 w-full max-w-4xl items-center justify-between gap-4 px-4">
          <Link href={ROUTES.home}>
            <AppLogo onlyIcon={false} />
          </Link>
          <Link
            href={ROUTES.myPages}
            className="inline-flex items-center rounded-pill border border-outline px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
          >
            Back to My pages
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="mb-5">
          <p className="text-xs text-text-muted">Analytics</p>
          <h1 className="mt-1 truncate text-[clamp(20px,3vw,26px)]">{title}</h1>
        </div>

        <section className="grid grid-cols-2 overflow-hidden rounded-lg sm:grid-cols-4">
          <Stat label="Views" value={summary.total_views} />
          <Stat label="Unique" value={summary.unique_views} />
          <Stat label="Read 50%" value={`${summary.read_50_pct}%`} />
          <Stat label="Read 100%" value={`${summary.read_100_pct}%`} />
        </section>

        <section className="mt-6 rounded-lg border border-outline bg-bg-elevated p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">Views last 30 days</h2>
            <span className="text-xs text-text-muted">{maxDayViews} peak day</span>
          </div>
          <div className="flex h-36 items-end gap-1">
            {summary.views_by_day.map((row) => (
              <div key={row.date} className="flex min-w-0 flex-1 items-end">
                <div
                  className="w-full rounded-t bg-accent/70"
                  style={{ height: pctWidth(row.views, maxDayViews) }}
                  title={`${row.date}: ${row.views} views`}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-lg border border-outline bg-bg-elevated p-4">
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

          <section className="rounded-lg border border-outline bg-bg-elevated p-4">
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
      </main>
    </div>
  );
}
