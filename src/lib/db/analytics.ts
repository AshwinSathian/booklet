import { getDb } from "@/lib/mongodb";
import type { AnalyticsEvent } from "./types";

export type PageAnalyticsSummary = {
  total_views: number;
  unique_views: number;
  read_50_pct: number;
  read_100_pct: number;
  referrers: Record<AnalyticsEvent["referrer_bucket"], number>;
  top_countries: Array<{ country: string; count: number }>;
  views_by_day: Array<{ date: string; views: number }>;
};

const REFERRER_BUCKETS: AnalyticsEvent["referrer_bucket"][] = [
  "slack",
  "twitter",
  "github",
  "email",
  "direct",
  "other",
];

type CountResult = {
  _id: AnalyticsEvent["event"];
  sessions: string[];
  count: number;
};

type BucketCount<T extends string | null> = {
  _id: T;
  count: number;
};

function emptyReferrers(): PageAnalyticsSummary["referrers"] {
  return Object.fromEntries(REFERRER_BUCKETS.map((b) => [b, 0])) as PageAnalyticsSummary["referrers"];
}

function last30Days(): PageAnalyticsSummary["views_by_day"] {
  const days: PageAnalyticsSummary["views_by_day"] = [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 29);

  for (let i = 0; i < 30; i += 1) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    days.push({ date: d.toISOString().slice(0, 10), views: 0 });
  }

  return days;
}

export async function getPageAnalytics(pageId: string): Promise<PageAnalyticsSummary> {
  const db = await getDb();
  const coll = db.collection<AnalyticsEvent>("analytics_events");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [eventCounts, referrerCounts, countryCounts, dayCounts] = await Promise.all([
    coll
      .aggregate<CountResult>([
        { $match: { page_id: pageId, created_at: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: "$event",
            sessions: { $addToSet: "$session_hash" },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    coll
      .aggregate<BucketCount<AnalyticsEvent["referrer_bucket"]>>([
        { $match: { page_id: pageId, event: "view", created_at: { $gte: thirtyDaysAgo } } },
        { $group: { _id: "$referrer_bucket", count: { $sum: 1 } } },
      ])
      .toArray(),
    coll
      .aggregate<BucketCount<string>>([
        {
          $match: {
            page_id: pageId,
            event: "view",
            country: { $ne: null },
            created_at: { $gte: thirtyDaysAgo },
          },
        },
        { $group: { _id: "$country", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ])
      .toArray(),
    coll
      .aggregate<BucketCount<string>>([
        { $match: { page_id: pageId, event: "view", created_at: { $gte: thirtyDaysAgo } } },
        { $group: { _id: { $substr: ["$created_at", 0, 10] }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
  ]);

  const counts = new Map(eventCounts.map((r) => [r._id, r]));
  const views = counts.get("view");
  const uniqueViews = views?.sessions.length ?? 0;
  const read50 = counts.get("read_50")?.sessions.length ?? 0;
  const read100 = counts.get("read_100")?.sessions.length ?? 0;

  const referrers = emptyReferrers();
  for (const row of referrerCounts) {
    referrers[row._id] = row.count;
  }

  const viewsByDay = last30Days();
  const byDayIndex = new Map(viewsByDay.map((row) => [row.date, row]));
  for (const row of dayCounts) {
    const existing = byDayIndex.get(row._id);
    if (existing) existing.views = row.count;
  }

  return {
    total_views: views?.count ?? 0,
    unique_views: uniqueViews,
    read_50_pct: uniqueViews > 0 ? Math.round((read50 / uniqueViews) * 100) : 0,
    read_100_pct: uniqueViews > 0 ? Math.round((read100 / uniqueViews) * 100) : 0,
    referrers,
    top_countries: countryCounts.map((row) => ({ country: row._id, count: row.count })),
    views_by_day: viewsByDay,
  };
}
