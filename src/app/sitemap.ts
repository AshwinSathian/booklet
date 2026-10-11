import { getDocsTree } from "@/lib/docs";
import { ROUTES } from "@/lib/constants";
import { absoluteUrl } from "@/lib/seo";
import { TEMPLATES } from "@/lib/templates";
import type { MetadataRoute } from "next";

// The site's own pages. Published pages (/p/...) are left out: they are
// their authors', and most are unlisted. Explore and the tag pages are
// left out too: they are not indexed.
const PAGES: Array<[path: string, priority: number, changeFrequency: "weekly" | "monthly"]> = [
  [ROUTES.home, 1, "weekly"],
  [ROUTES.app, 0.9, "monthly"],
  [ROUTES.docs, 0.9, "weekly"],
  [ROUTES.templates, 0.8, "monthly"],
  [ROUTES.pricing, 0.6, "monthly"],
  [ROUTES.changelog, 0.6, "weekly"],
  ["/about", 0.5, "monthly"],
  ["/trust", 0.5, "monthly"],
  ["/privacy", 0.3, "monthly"],
  ["/terms", 0.3, "monthly"],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    ...PAGES.map(([path, priority, changeFrequency]) => ({ url: absoluteUrl(path), lastModified, changeFrequency, priority })),
    ...getDocsTree()
      .flatMap((section) => section.pages)
      .map((page) => ({ url: absoluteUrl(page.href), lastModified, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...TEMPLATES.filter((t) => t.slug).map((t) => ({
      url: absoluteUrl(`/templates/${t.slug}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
