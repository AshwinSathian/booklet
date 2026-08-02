import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { getPublicPagesByUser } from "@/lib/db";
import { getUserById } from "@/lib/db/auth";
import type { DbUser } from "@/lib/db/types";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import type { ExploreItem } from "@/lib/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function displayName(user: DbUser): string {
  return user.display_name?.trim() || "Booklet user";
}

// Deterministic hue from the user id so the same author always gets the
// same avatar color, with no external avatar service (Gravatar, etc.)
// and no image asset to store.
function avatarHue(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await getUserById(id);
  if (!user) return buildMetadata({ title: "User not found", noIndex: true });
  const name = displayName(user);
  return buildMetadata({
    title: `${name} — ${APP_NAME}`,
    description: `Public pages published by ${name} on ${APP_NAME}.`,
    pathname: `/u/${id}`,
  });
}

function pageHref(item: ExploreItem) {
  return `/p/${item.slug ?? item.id}`;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, pages] = await Promise.all([
    getUserById(id),
    getPublicPagesByUser(id).catch(() => [] as ExploreItem[]),
  ]);

  if (!user) notFound();

  const name = displayName(user);
  const initials = name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <AppLogo onlyIcon={false} />
          <Button variant="primary" size="md" href={ROUTES.app}>
            <span className="hidden sm:inline">Make your own</span>
            <span className="sm:hidden">Write</span>
            <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
              <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        {/* Profile hero */}
        <div className="flex items-center gap-4 mb-10">
          {/* Avatar — deterministic initials, no external image service */}
          <div
            className="h-16 w-16 rounded-full border flex items-center justify-center shrink-0"
            style={{
              backgroundColor: `hsl(${avatarHue(user.id)} 70% 92% / 1)`,
              borderColor: `hsl(${avatarHue(user.id)} 70% 80% / 1)`,
            }}
          >
            <span className="text-xl font-bold" style={{ color: `hsl(${avatarHue(user.id)} 60% 40%)` }}>
              {initials}
            </span>
          </div>

          <div className="min-w-0">
            <h1 className="text-[clamp(20px,3vw,26px)] text-text-primary truncate">{name}</h1>
            <p className="text-sm text-text-muted mt-1">
              {pages.length === 0
                ? "No public pages yet."
                : `${pages.length} public ${pages.length === 1 ? "page" : "pages"}`}
            </p>
          </div>
        </div>

        {/* Pages */}
        {pages.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pages.map((page) => (
              <Link
                key={page.id}
                href={pageHref(page)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-elevated p-4 transition hover:border-accent-soft/30 hover:bg-fill-1"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary group-hover:text-accent transition line-clamp-2 leading-snug mb-1">
                    {page.title ?? "Untitled"}
                  </p>
                  <p className="text-2xs text-text-muted/60 font-mono truncate">
                    {page.slug ? `/p/${page.slug}` : `/p/${page.id}`}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3 gap-2">
                  <span className="text-2xs text-text-muted/50">{timeAgo(page.created_at)}</span>
                  <span className="text-2xs text-text-muted/50 tabular-nums">
                    {page.view_count === 1 ? "1 view" : `${page.view_count.toLocaleString()} views`}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-subtle px-6 py-16 text-center">
            <p className="text-sm text-text-muted">No public pages yet.</p>
          </div>
        )}
      </main>

      <footer className="mt-12 border-t border-border-subtle">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <AppLogo onlyIcon={false} />
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <Link href="/explore" className="transition hover:text-text-primary">Explore</Link>
            <Link href="/about" className="transition hover:text-text-primary">About</Link>
            <Link href={ROUTES.app} className="transition hover:text-text-primary">Write</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export async function generateStaticParams() {
  return [];
}
