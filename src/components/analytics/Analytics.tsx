"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function getGaId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!id) return null;
  if (!id.startsWith("G-")) return null;
  return id;
}

export function Analytics() {
  const gaId = getGaId();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track SPA navigations as pageviews.
  useEffect(() => {
    if (!gaId) return;
    if (!window.gtag) return;

    const qs = searchParams?.toString();
    const page_path = qs ? `${pathname}?${qs}` : pathname;

    // We disable default pageview and send manually on route changes.
    window.gtag("event", "page_view", { page_path });
  }, [gaId, pathname, searchParams]);

  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());

          // Disable automatic page_view; we send page_view on route changes.
          gtag('config', '${gaId}', {
            send_page_view: false,
            anonymize_ip: true
          });
        `}
      </Script>
    </>
  );
}
