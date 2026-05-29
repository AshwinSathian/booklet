import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";
import { getCollectionBySlug, getCollectionMembers, getCollectionMemberships, getPagesByCollection } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
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
  return { title: `${team.name} — Readable` };
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const team = await getCollectionBySlug(slug);
  if (!team) notFound();

  const { userId } = await auth();
  const isMember = userId
    ? (await getCollectionMemberships(userId)).some((m) => m.collection_id === team.id)
    : false;
  const isOwner = team.user_id === userId;

  const [pages, members] = await Promise.all([
    getPagesByCollection(team.id),
    getCollectionMembers(team.id),
  ]);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="border-b border-border-subtle bg-bg/85 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto w-full max-w-3xl px-4 h-12 flex items-center justify-between gap-4">
          <Link href="/">
            <AppLogo onlyIcon={false} />
          </Link>
          {(isOwner || isMember) && (
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

        {pages.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-text-muted text-sm">No public pages in this team yet.</p>
            {(isOwner || isMember) && (
              <div className="mt-4">
                <Link
                  href={ROUTES.app}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
                >
                  Create a page →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pages.map((page) => (
              <Link
                key={page.id}
                href={`/p/${page.slug ?? page.id}`}
                className="group flex flex-col justify-between rounded-xl border border-border-subtle p-4 hover:border-accent-soft/40 hover:bg-fill-1 transition"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary group-hover:text-accent transition truncate">
                    {page.title ?? "Untitled"}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-2xs text-text-muted">{timeAgo(page.created_at)}</span>
                  <div className="flex items-center gap-1 text-2xs text-text-muted">
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M1 8C2.5 4.5 5 3 8 3s5.5 1.5 7 5c-1.5 3.5-4 5-7 5S2.5 11.5 1 8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    {page.view_count.toLocaleString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
