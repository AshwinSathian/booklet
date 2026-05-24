import { ROUTES } from "@/lib/constants";
import { absoluteUrl } from "@/lib/seo";
import { TEMPLATES } from "@/lib/templates";
import type { MetadataRoute } from "next";

// Static routes only. User-generated /p/[id] pages are intentionally excluded
// (they're ephemeral and user-controlled).

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl(ROUTES.home),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: absoluteUrl(ROUTES.app),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/templates"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: absoluteUrl("/api-docs"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: absoluteUrl("/mcp-setup"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl("/explore"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.65,
    },
    {
      url: absoluteUrl("/changelog"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/about"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/privacy"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: absoluteUrl("/terms"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const templateRoutes: MetadataRoute.Sitemap = TEMPLATES.filter((t) => t.slug).map((t) => ({
    url: absoluteUrl(`/templates/${t.slug}`),
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...templateRoutes];
}
