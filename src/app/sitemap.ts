import { ROUTES } from "@/lib/constants";
import { absoluteUrl } from "@/lib/seo";
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
  ];
}
