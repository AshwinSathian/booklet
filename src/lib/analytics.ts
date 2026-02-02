export type AnalyticsEventParams = Record<string, string | number | boolean>;

export function trackEvent(name: string, params?: AnalyticsEventParams) {
  if (typeof window === "undefined") return;
  const gtag = (window as any).gtag as undefined | ((...args: any[]) => void);
  if (!gtag) return;

  // Keep params shallow and safe (no content).
  gtag("event", name, params ?? {});
}
