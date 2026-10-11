import { AppPage, AppPageTitle, EmptyState } from "@/components/app/AppPage";
import { Button } from "@/components/ui/Button";
import { SpaceGroups } from "@/components/share/SpaceGroups";
import { ROUTES } from "@/lib/constants";
import { getCollectionBySlug, getCollectionMembers, getSpacePages, hasPublicSpacePage } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { groupSpacePages } from "@/lib/space-groups";
import { spaceRole } from "@/server/access";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo";
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
  if (!team) return buildMetadata({ title: "Team not found", noIndex: true });
  // The feed link is only advertised when there is a feed (see feed.xml/route.ts).
  // A space with nothing public in it has nothing for a search engine either.
  const hasFeed = await hasPublicSpacePage(team.id);
  const base = buildMetadata({
    title: team.name,
    description: `Pages published in the ${team.name} team space on Booklet.`,
    pathname: `/t/${slug}`,
    noIndex: !hasFeed,
  });
  return hasFeed ? { ...base, alternates: { ...base.alternates, types: { "application/atom+xml": `/t/${slug}/feed.xml` } } } : base;
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
          <SpaceGroups groups={groups} />
        )}
    </AppPage>
  );
}
