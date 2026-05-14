import type { AnalyticsEventName } from "./analytics-events";

export type AnalyticsEventParams = Record<string, string | number | boolean>;

export function trackEvent(
  name: AnalyticsEventName,
  params?: AnalyticsEventParams,
) {
  if (typeof window === "undefined") return;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (!gtag) return;

  // Keep params shallow and safe (no content).
  gtag("event", name, params ?? {});
}
