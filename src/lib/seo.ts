import { APP_NAME, ROUTES } from "@/lib/constants";
import type { Metadata } from "next";

const FALLBACK_ORIGIN = "https://booklet.ashwinsathian.com";

export function getEnvOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && /^https?:\/\//i.test(env)) return env.replace(/\/$/, "");
  return null;
}

export function absoluteUrl(pathname: string, originOverride?: string) {
  const origin = (originOverride ?? getEnvOrigin() ?? FALLBACK_ORIGIN).replace(
    /\/$/,
    "",
  );
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin}${path}`;
}

type BuildMetaArgs = {
  title?: string;
  description?: string;
  pathname?: string;
  noIndex?: boolean;
  origin?: string;
};

const DEFAULT_TITLE = `${APP_NAME} — Share Beautiful Markdown Pages Instantly`;
const DEFAULT_DESC =
  "Convert any Markdown into a clean, beautifully formatted shareable page in seconds. Perfect for incident reports, ADRs, READMEs, and technical docs. Free, no account required.";

export function buildMetadata({
  title,
  description,
  pathname,
  noIndex,
  origin,
}: BuildMetaArgs): Metadata {
  const resolvedTitle =
    title && title !== APP_NAME ? `${title} — ${APP_NAME}` : DEFAULT_TITLE;

  const resolvedDesc = description ?? DEFAULT_DESC;

  const canonicalPath = pathname ?? ROUTES.home;
  const url = absoluteUrl(canonicalPath, origin);

  const ogImage = absoluteUrl("/opengraph-image", origin);
  const twitterImage = absoluteUrl("/twitter-image", origin);

  return {
    title: resolvedTitle,
    description: resolvedDesc,
    applicationName: APP_NAME,
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },

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
          alt: `${APP_NAME} — Share Beautiful Markdown Pages`,
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
          alt: `${APP_NAME} — Share Beautiful Markdown Pages`,
        },
      ],
    },
  };
}
