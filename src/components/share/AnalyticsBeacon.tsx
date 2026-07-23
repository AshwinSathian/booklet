"use client";

import { useEffect, useRef } from "react";

type AnalyticsEvent = "view" | "read_50" | "read_100" | "cta_click";

function sendAnalytics(payload: { pageId: string; event: AnalyticsEvent; referrer?: string }) {
  const body = JSON.stringify(payload);
  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/analytics/view", blob);
    return;
  }

  void fetch("/api/analytics/view", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function AnalyticsBeacon({ pageId }: { pageId: string }) {
  const fired50 = useRef(false);
  const fired100 = useRef(false);

  useEffect(() => {
    sendAnalytics({ pageId, event: "view", referrer: document.referrer });

    function onScroll() {
      const total = document.documentElement.scrollHeight;
      if (total <= 0) return;

      const scrolled = window.scrollY + window.innerHeight;
      const pct = scrolled / total;

      if (!fired50.current && pct >= 0.5) {
        fired50.current = true;
        sendAnalytics({ pageId, event: "read_50" });
      }

      if (!fired100.current && pct >= 0.95) {
        fired100.current = true;
        sendAnalytics({ pageId, event: "read_100" });
      }
    }

    function onCtaClick(e: MouseEvent) {
      const target = (e.target as Element).closest("[data-booklet-cta]");
      if (target) {
        sendAnalytics({ pageId, event: "cta_click" });
      }
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onCtaClick, { capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onCtaClick, { capture: true });
    };
  }, [pageId]);

  return null;
}
