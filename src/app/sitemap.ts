import { RELEASES } from "@/lib/changelog";
import { ROUTES } from "@/lib/constants";
import { getPublicPagesForSitemap } from "@/lib/db";
import { getDocsTree } from "@/lib/docs";
import { absoluteUrl } from "@/lib/seo";
import { TEMPLATES } from "@/lib/templates";
import type { MetadataRoute } from "next";

// Read from the database, so not built ahead of time; kept for an hour, so a crawler's visits cost one query.
export const revalidate = 3600;

// The site's own pages, then the pages their authors made public. Not here:
// the editor and anything else that is not indexed (Explore and the tag
// pages are followed, not indexed), and pages that are unlisted, behind a
// password or for a team.
const PAGES: Array<[path: string, priority: number, changeFrequency: "weekly" | "monthly"]> = [
  [ROUTES.home, 1, "weekly"],
  [ROUTES.docs, 0.9, "weekly"],
  [ROUTES.templates, 0.8, "monthly"],
  [ROUTES.pricing, 0.6, "monthly"],
  [ROUTES.changelog, 0.6, "weekly"],
  ["/about", 0.5, "monthly"],
  ["/trust", 0.5, "monthly"],
  ["/privacy", 0.3, "monthly"],
  ["/terms", 0.3, "monthly"],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A date is given only where one is known: the changelog's newest release,
  // and a published page's last update. "Now" on every URL teaches a crawler
  // to ignore the field.
  const released = new Date(`${RELEASES[0].date}T00:00:00Z`);
  const published = await getPublicPagesForSitemap().catch(() => []);
  return [
    ...PAGES.map(([path, priority, changeFrequency]) => ({
      url: absoluteUrl(path),
      changeFrequency,
      priority,
      ...(path === ROUTES.changelog || path === ROUTES.home ? { lastModified: released } : {}),
    })),
    ...getDocsTree()
      .flatMap((section) => section.pages)
      .map((page) => ({ url: absoluteUrl(page.href), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...TEMPLATES.map((t) => ({
      url: absoluteUrl(`/templates/${t.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...published.map((page) => ({
      url: absoluteUrl(`/p/${page.key}`),
      lastModified: new Date(page.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  ];
}
