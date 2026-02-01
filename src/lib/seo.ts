import { APP_NAME, ROUTES } from "@/lib/constants";
import type { Metadata } from "next";

const FALLBACK_ORIGIN = "https://readable.ashwinsathian.com";

export function getSiteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && /^https?:\/\//i.test(env)) return env.replace(/\/$/, "");
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
};

export function buildMetadata({
  title,
  description,
  pathname,
  noIndex,
}: BuildMetaArgs): Metadata {
  const resolvedTitle =
    title && title !== APP_NAME
      ? `${title} — ${APP_NAME}`
      : `${APP_NAME} — Paste. Preview. Share.`;

  const resolvedDesc =
    description ??
    "Turn pasted text into clean, confidently shareable pages for non-technical readers.";

  const url = absoluteUrl(pathname ?? ROUTES.home);

  const ogImage = absoluteUrl("/opengraph-image");
  const twitterImage = absoluteUrl("/twitter-image");

  return {
    title: resolvedTitle,
    description: resolvedDesc,
    applicationName: APP_NAME,

    alternates: {
      canonical: url,
    },

    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },

    openGraph: {
      type: "website",
      siteName: APP_NAME,
      title: resolvedTitle,
      description: resolvedDesc,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${APP_NAME} preview`,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDesc,
      images: [
        {
          url: twitterImage,
          width: 1200,
          height: 630,
          alt: `${APP_NAME} preview`,
        },
      ],
    },
  };
}
