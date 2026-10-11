import { AppPage, AppPageTitle, EmptyState } from "@/components/app/AppPage";
import { Button } from "@/components/ui/Button";
import { StatusChip, formatDocDate } from "@/components/share/DocHeaderStrip";
import { ROUTES } from "@/lib/constants";
import { getCollectionBySlug, getCollectionMembers, getSpacePages, hasPublicSpacePage } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { groupSpacePages } from "@/lib/space-groups";
import { spaceRole } from "@/server/access";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const team = await getCollectionBySlug(slug);
  if (!team) return { title: "Team not found" };
  // The feed link is only advertised when there is a feed (see feed.xml/route.ts).
  const hasFeed = await hasPublicSpacePage(team.id);
  return {
    title: `${team.name} — Booklet`,
    ...(hasFeed ? { alternates: { types: { "application/atom+xml": `/t/${slug}/feed.xml` } } } : {}),
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const team = await getCollectionBySlug(slug);
  if (!team) notFound();

  const userId = (await getSession())?.userId ?? null;
  // Members see every page in the space. Everyone else sees its public
  // pages: an unlisted or team-only page is never named to them.
  const role = await spaceRole(team, userId);
  const [pages, members] = await Promise.all([getSpacePages(team.id, role === null), getCollectionMembers(team.id)]);
  const groups = groupSpacePages(pages);

  return (
    <AppPage>
        <AppPageTitle
          eyebrow="Space"
          title={team.name}
          lede={`${members.length} ${members.length === 1 ? "member" : "members"} · ${pages.length} ${pages.length === 1 ? "page" : "pages"}`}
          action={
            role ? (
              <Button variant="secondary" size="lg" href={`/t/${slug}/admin`}>
                Manage
              </Button>
            ) : null
          }
        />

        {groups.length === 0 ? (
          <EmptyState
            title={role ? "No pages in this space yet" : "No public pages in this space yet"}
            action={
              role && role !== "viewer" ? (
                <Button variant="primary" size="lg" href={ROUTES.app}>
                  Write a page
                </Button>
              ) : null
            }
          >
            {role && role !== "viewer" ? <>In the editor, choose &ldquo;Team only ({team.name})&rdquo; next to Publish.</> : null}
          </EmptyState>
        ) : (
          <div className="space-y-10">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`group-${group.key}`} data-group={group.key}>
                <h2 id={`group-${group.key}`} className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
                  {group.heading} <span className="font-normal tabular-nums">({group.pages.length})</span>
                </h2>
                <ul className="mt-3 divide-y divide-border-default border-y border-border-default">
                  {group.pages.map((page) => {
                    const status = page.frontmatter_meta?.status;
                    const date = page.frontmatter_meta?.date;
                    return (
                      <li key={page.id}>
                        <Link
                          href={ROUTES.publish(page.slug ?? page.id)}
                          className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3.5"
                        >
                          <span className="min-w-0 truncate text-sm font-medium text-text-primary group-hover:underline underline-offset-3">
                            {page.title ?? "Untitled"}
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-xs text-text-muted">
                            {typeof status === "string" && status ? <StatusChip status={status} /> : null}
                            {page.visibility !== "public" ? (
                              <span>{page.visibility === "team" ? "Team only" : "Unlisted"}</span>
                            ) : null}
                            <time>{formatDocDate(typeof date === "string" && date ? date : page.created_at)}</time>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
    </AppPage>
  );
}
