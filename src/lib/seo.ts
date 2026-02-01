import { APP_NAME, ROUTES } from "@/lib/constants";
import type { Metadata } from "next";

const FALLBACK_ORIGIN = "https://readable.ashwinsathian.com";

export function getSiteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (env && /^https?:\/\//i.test(env)) return env.replace(/\/$/, "");

  const vercelHost = process.env.VERCEL_URL;
  if (vercelHost) return `https://${vercelHost}`;

  return FALLBACK_ORIGIN;
}

export function absoluteUrl(pathname: string) {
  const origin = getSiteOrigin();
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin}${path}`;
}

type BuildMetaArgs = {
  title?: string;
  description?: string;
  pathname?: string;
  noIndex?: boolean;
  openGraph?: Metadata["openGraph"];
  twitter?: Metadata["twitter"];
};

export function buildMetadata({
  title,
  description,
  pathname,
  noIndex,
  openGraph,
  twitter,
}: BuildMetaArgs): Metadata {
  const base = new URL(getSiteOrigin());

  const resolvedTitle =
    title && title !== APP_NAME
      ? `${title} — ${APP_NAME}`
      : `${APP_NAME} — Paste. Preview. Share.`;

  const resolvedDesc =
    description ??
    "Turn pasted tech-heavy text into clean, confidently shareable pages for non-technical readers.";

  const canonicalPath = pathname ?? ROUTES.home;
  const url = absoluteUrl(canonicalPath);

  // Force explicit image URLs so crawlers don’t rely on framework conventions.
  const ogImage = absoluteUrl("/opengraph-image");
  const twImage = absoluteUrl("/twitter-image");

  return {
    metadataBase: base,
    title: resolvedTitle,
    description: resolvedDesc,
    applicationName: APP_NAME,
    alternates: { canonical: url },
    robots: noIndex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : { index: true, follow: true, googleBot: { index: true, follow: true } },

    openGraph: {
      type: "website",
      siteName: APP_NAME,
      title: resolvedTitle,
      description: resolvedDesc,
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt: APP_NAME }],
      ...(openGraph ?? {}),
    },

    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDesc,
      images: [twImage],
      ...(twitter ?? {}),
    },
  };
}
