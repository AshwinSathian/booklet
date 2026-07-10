import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

/**
 * Metadata for a password-protected page while it's locked — deliberately
 * generic, with no page-specific title, description, or image.
 *
 * Next.js calls generateMetadata() independently of whatever the page
 * component itself renders, so if metadata were ever computed from the
 * real title/description first, a locked page's secret content would leak
 * to any unauthenticated request (curl, a crawler, a link-unfurler) via
 * <title>, og:title/description, the Twitter card, and the OG/Twitter image
 * URL (which embeds the title as a query param) — no password required,
 * before the page component ever gets a chance to gate anything.
 *
 * Callers must invoke this *before* touching the real title/description for
 * a locked page, not merely alongside it.
 *
 * Locked pages are also marked noIndex, same as unlisted pages: a search
 * engine indexing this placeholder as if it were the real content serves no
 * one, and a locked page's content shouldn't be crawlable at all.
 *
 * We deliberately don't pass an `openGraph`/`twitter` override here (unlike
 * the unlocked path) — buildMetadata()'s own default images are already
 * generic (no title query param), so simply not overriding them keeps this
 * path from ever constructing a title-bearing image URL.
 */
export function buildLockedPageMetadata(pathname: string): Metadata {
  return buildMetadata({
    title: "Password-protected page",
    description: "This page is password protected. Enter the password to view it.",
    pathname,
    noIndex: true,
  });
}
