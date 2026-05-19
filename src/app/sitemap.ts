import { ROUTES } from "@/lib/constants";
import { absoluteUrl } from "@/lib/seo";
import { TEMPLATES } from "@/lib/templates";
import type { MetadataRoute } from "next";

// MVP sitemap: just static routes.
// Share pages are user-generated and expire; we intentionally do not list them.

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: absoluteUrl(ROUTES.home),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl(ROUTES.app),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/api-docs"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/pricing"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/templates"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/explore"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...TEMPLATES.filter((t) => t.slug).map((t) => ({
      url: absoluteUrl(`/templates/${t.slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
