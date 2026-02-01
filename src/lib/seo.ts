import { APP_NAME, ROUTES } from "@/lib/constants";
import type { Metadata } from "next";

// Centralized SEO helpers (MVP-safe):
// - Works without any env vars.
// - If you set NEXT_PUBLIC_SITE_URL in Cloudflare/Vercel/etc, OG URLs become absolute.

const FALLBACK_ORIGIN = "http://localhost:3000";

export function getSiteOrigin() {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (env && /^https?:\/\//i.test(env)) return env.replace(/\/$/, "");

  // Vercel-style host envs (harmless elsewhere)
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

  const url = absoluteUrl(pathname ?? ROUTES.home);

  return {
    metadataBase: base,
    title: resolvedTitle,
    description: resolvedDesc,
    applicationName: APP_NAME,
    alternates: {
      canonical: url,
    },
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
      ...(openGraph ?? {}),
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDesc,
      ...(twitter ?? {}),
    },
  };
}
