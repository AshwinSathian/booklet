import { getDb } from "@/lib/mongodb";
import type { PublishEvent, AnalyticsEvent } from "./types";

export type AdminMetrics = {
  // Publish funnel
  weeklyNewPages: number;
  weeklyUpdates: number;
  monthlyRepublishRate: number;       // % of users who published 2+ times in 30 days
  anonymousPublishPct: number;        // % of publishes with no user_id
  apiPublishPct: number;              // % of publishes via API (not browser)
  // Share page funnel
  weeklyShareViews: number;
  ctaClickRate: number;               // cta_click / view (last 7 days, %)
  readCompletionRate: number;         // read_100 / view (last 7 days, %)
  // Referrer breakdown (last 7 days)
  topReferrers: Array<{ bucket: string; count: number }>;
  // Growth
  totalPagesPublished: number;
  totalPagesOwned: number;
};

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const db = await getDb();
  const publishColl = db.collection<PublishEvent>("publish_events");
  const analyticsColl = db.collection<AnalyticsEvent>("analytics_events");
  const pagesColl = db.collection("pages");

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 86_400_000).toISOString();

  const [
    weeklyPublishes,
    monthlyPublishes,
    weeklyAnalytics,
    totalPublished,
    totalOwned,
  ] = await Promise.all([
    // Last 7 days of publish events
    publishColl
      .find({ created_at: { $gte: sevenDaysAgo } })
      .project<Pick<PublishEvent, "user_id" | "is_update" | "source">>({ user_id: 1, is_update: 1, source: 1 })
      .toArray(),

    // Last 30 days for re-publish rate
    publishColl
      .aggregate<{ _id: string; count: number }>([
        { $match: { created_at: { $gte: thirtyDaysAgo }, user_id: { $ne: null }, is_update: false } },
        { $group: { _id: "$user_id", count: { $sum: 1 } } },
      ])
      .toArray(),

    // Last 7 days of analytics events
    analyticsColl
      .aggregate<{ _id: AnalyticsEvent["event"]; count: number }>([
        { $match: { created_at: { $gte: sevenDaysAgo } } },
        { $group: { _id: "$event", count: { $sum: 1 } } },
      ])
      .toArray(),

    // All-time new publish events
    publishColl.countDocuments({ is_update: false }),

    // All-time owned pages (have a DB record)
    pagesColl.countDocuments(),
  ]);

  // --- Publish funnel ---
  const newPages = weeklyPublishes.filter((e) => !e.is_update);
  const updates = weeklyPublishes.filter((e) => e.is_update);
  const weeklyNewPages = newPages.length;
  const weeklyUpdates = updates.length;

  const anonymousPublishPct =
    weeklyPublishes.length > 0
      ? Math.round((weeklyPublishes.filter((e) => !e.user_id).length / weeklyPublishes.length) * 100)
      : 0;

  const apiPublishPct =
    weeklyPublishes.length > 0
      ? Math.round((weeklyPublishes.filter((e) => e.source === "api" || e.source === "cli").length / weeklyPublishes.length) * 100)
      : 0;

  const usersWhoRepublished = monthlyPublishes.filter((u) => u.count >= 2).length;
  const totalMonthlyPublishers = monthlyPublishes.length;
  const monthlyRepublishRate =
    totalMonthlyPublishers > 0
      ? Math.round((usersWhoRepublished / totalMonthlyPublishers) * 100)
      : 0;

  // --- Share page funnel ---
  const analyticsMap = new Map(weeklyAnalytics.map((r) => [r._id, r.count]));
  const weeklyShareViews = analyticsMap.get("view") ?? 0;
  const weeklyCta = analyticsMap.get("cta_click") ?? 0;
  const weeklyRead100 = analyticsMap.get("read_100") ?? 0;

  const ctaClickRate =
    weeklyShareViews > 0 ? Math.round((weeklyCta / weeklyShareViews) * 100) : 0;
  const readCompletionRate =
    weeklyShareViews > 0 ? Math.round((weeklyRead100 / weeklyShareViews) * 100) : 0;

  // --- Top referrers (last 7 days, view events only) ---
  const referrerAgg = await analyticsColl
    .aggregate<{ _id: string; count: number }>([
      { $match: { event: "view", created_at: { $gte: sevenDaysAgo } } },
      { $group: { _id: "$referrer_bucket", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  const topReferrers = referrerAgg.map((r) => ({ bucket: r._id, count: r.count }));

  return {
    weeklyNewPages,
    weeklyUpdates,
    monthlyRepublishRate,
    anonymousPublishPct,
    apiPublishPct,
    weeklyShareViews,
    ctaClickRate,
    readCompletionRate,
    topReferrers,
    totalPagesPublished: totalPublished,
    totalPagesOwned: totalOwned,
  };
}
