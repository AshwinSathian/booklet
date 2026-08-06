import { AppLogo } from "@/components/ui/AppLogo";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ROUTES } from "@/lib/constants";
import { getApiKeysByUser, getCollectionsByUser, getPagesByUser, getTeamSpacesByMembership, getWebhooksByUser } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { headers } from "next/headers";
import { MyPagesList } from "./MyPagesClient";
import { ApiKeysSection } from "./ApiKeysClient";
import { WebhooksSection } from "./WebhooksClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "My Pages — Booklet",
  robots: { index: false, follow: false },
};

function getBaseUrl(req: Headers): string {
  const host = req.get("host") ?? "booklet.page";
  const proto = req.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default async function MyPagesPage() {
  const session = await getSession();
  // Middleware only does a cheap cookie-presence redirect; this is the
  // authoritative check (see PLAN-backend-auth-migration.md).
  if (!session) {
    return null;
  }
  const { userId } = session;

  const hdrs = await headers();
  const baseUrl = getBaseUrl(hdrs);
  const [{ pages }, apiKeys, ownedCollections, teamSpaces, webhooks] = await Promise.all([
    getPagesByUser(userId),
    getApiKeysByUser(userId),
    getCollectionsByUser(userId),
    getTeamSpacesByMembership(userId),
    getWebhooksByUser(userId),
  ]);
  // Merge owned collections + team spaces the user is a member of (but doesn't own)
  const ownedIds = new Set(ownedCollections.map((c) => c.id));
  const collections = [...ownedCollections, ...teamSpaces.filter((c) => !ownedIds.has(c.id))];

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-6xl px-4 h-12 flex items-center justify-between gap-4">
          <AppLogo onlyIcon={false} />
          <div className="flex items-center gap-3">
            <Link
              href={ROUTES.app}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-pill border border-border-default px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
            >
              Back to editor
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium">My pages</h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              {pages.length === 0
                ? "No pages yet."
                : pages.length === 1
                  ? "1 page"
                  : `${pages.length} pages`}
            </p>
          </div>
          <Link
            href={ROUTES.app}
            className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-4 py-1.5 text-xs font-semibold text-accent-contrast transition hover:bg-accent-hover shrink-0"
          >
            New page
          </Link>
        </div>

        <ToastProvider>
          <MyPagesList
            initialPages={pages.map((p) => ({
              id: p.id,
              slug: p.slug,
              title: p.title,
              visibility: p.visibility,
              collection_id: p.collection_id,
              view_count: p.view_count,
              has_password: Boolean(p.password_hash),
              featured: p.featured,
              remove_attribution_badge: p.remove_attribution_badge,
              created_at: p.created_at,
              updated_at: p.updated_at,
            }))}
            initialCollections={collections.map((c) => ({
              id: c.id,
              name: c.name,
              is_team_space: c.is_team_space ?? false,
              parent_id: c.parent_id ?? null,
              created_at: c.created_at,
              updated_at: c.updated_at,
            }))}
            baseUrl={baseUrl}
          />
        </ToastProvider>

        <ApiKeysSection
          initialKeys={apiKeys.map((k) => ({
            id: k.id,
            label: k.label,
            created_at: k.created_at,
            last_used_at: k.last_used_at,
          }))}
        />

        <WebhooksSection
          initialWebhooks={webhooks.map((w) => ({
            id: w.id,
            url: w.url,
            events: w.events,
            created_at: w.created_at,
            last_triggered_at: w.last_triggered_at,
          }))}
        />
      </main>
    </div>
  );
}
