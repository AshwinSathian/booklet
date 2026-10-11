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
  /** Path of this page's own link-preview image (see src/app/og). The site's card when left out. */
  image?: string;
  /** What the image shows, for people who cannot see it. */
  imageAlt?: string;
};

export const DEFAULT_TITLE = `${APP_NAME}: incident reports, ADRs and runbooks as web pages`;
export const OG_SITE_IMAGE = "/og/site.png";
export const OG_SITE_ALT = `${APP_NAME}: write it in Markdown, publish it as a page.`;
const DEFAULT_DESC =
  "Publish Markdown incident reports, ADRs, RFCs and runbooks as web pages, with team spaces.";

export function buildMetadata({
  title,
  description,
  pathname,
  noIndex,
  origin,
  image,
  imageAlt,
}: BuildMetaArgs): Metadata {
  const resolvedTitle =
    title && title !== APP_NAME ? `${title} — ${APP_NAME}` : DEFAULT_TITLE;

  const resolvedDesc = description ?? DEFAULT_DESC;

  const canonicalPath = pathname ?? ROUTES.home;
  const url = absoluteUrl(canonicalPath, origin);

  // One PNG for every network: none of them shows an SVG.
  const preview = { url: absoluteUrl(image ?? OG_SITE_IMAGE, origin), width: 1200, height: 630, type: "image/png", alt: imageAlt ?? OG_SITE_ALT };

  return {
    title: resolvedTitle,
    description: resolvedDesc,
    applicationName: APP_NAME,
    alternates: { canonical: url },
    // Not indexed, but its links are followed: Explore and the tag pages are
    // how a crawler reaches the pages their authors made public.
    robots: noIndex
      ? { index: false, follow: true }
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
      locale: "en_US",
      title: resolvedTitle,
      description: resolvedDesc,
      url,
      images: [preview],
    },

    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDesc,
      images: [preview],
    },
  };
}

/** A schema.org BreadcrumbList for a trail of [name, path] pairs, the last being the page itself. */
export function breadcrumbJsonLd(trail: Array<[name: string, path: string]>) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: absoluteUrl(path) })),
  };
}

/** JSON for a <script type="application/ld+json">. "<" is escaped so no value can close the script element. */
export function jsonLdScript(graph: object[]): string {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
}
