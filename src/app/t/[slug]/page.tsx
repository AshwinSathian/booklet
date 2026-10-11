import { AppLogo } from "@/components/ui/AppLogo";
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
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="border-b border-border-subtle bg-bg/85 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto w-full max-w-3xl px-4 h-12 flex items-center justify-between gap-4">
          <AppLogo onlyIcon={false} />
          {role && (
            <Link
              href={`/t/${slug}/admin`}
              className="text-xs text-text-muted hover:text-text-primary transition"
            >
              Manage
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-[clamp(20px,3vw,26px)]">{team.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {members.length} {members.length === 1 ? "member" : "members"} &middot;{" "}
            {pages.length} {pages.length === 1 ? "page" : "pages"}
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-text-muted text-sm">
              {role ? "No pages in this space yet." : "No public pages in this space yet."}
            </p>
            {role && role !== "viewer" && (
              <div className="mt-4">
                <Link
                  href={ROUTES.app}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast transition hover:bg-accent-hover"
                >
                  Write a page →
                </Link>
                <p className="mt-3 text-xs text-text-muted">
                  In the editor, choose &ldquo;Team only ({team.name})&rdquo; next to Publish.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`group-${group.key}`} data-group={group.key}>
                <h2 id={`group-${group.key}`} className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {group.heading} <span className="font-normal tabular-nums">({group.pages.length})</span>
                </h2>
                <ul className="mt-3 divide-y divide-border-subtle border-y border-border-subtle">
                  {group.pages.map((page) => {
                    const status = page.frontmatter_meta?.status;
                    const date = page.frontmatter_meta?.date;
                    return (
                      <li key={page.id}>
                        <Link
                          href={ROUTES.publish(page.slug ?? page.id)}
                          className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 transition hover:bg-fill-1"
                        >
                          <span className="min-w-0 truncate text-sm font-medium text-text-primary group-hover:text-accent transition">
                            {page.title ?? "Untitled"}
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-2xs text-text-muted">
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
      </main>
    </div>
  );
}
