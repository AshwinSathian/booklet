import { AppPage, AppPageTitle } from "@/components/app/AppPage";
import { Button } from "@/components/ui/Button";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { ROUTES } from "@/lib/constants";
import { getCollectionsByUser, getPagesByUser, getTeamSpacesByMembership } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { headers } from "next/headers";
import { MyPagesList } from "./MyPagesClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "My pages · Booklet",
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
  // authoritative check.
  if (!session) {
    return null;
  }
  const { userId } = session;

  const hdrs = await headers();
  const baseUrl = getBaseUrl(hdrs);
  // Every row is one of the caller's own pages (getPagesByUser), so titles
  // and publish sources need no further access check.
  const [{ pages }, ownedCollections, teamSpaces] = await Promise.all([
    getPagesByUser(userId),
    getCollectionsByUser(userId),
    getTeamSpacesByMembership(userId),
  ]);
  // Merge owned collections + team spaces the user is a member of (but doesn't own)
  const ownedIds = new Set(ownedCollections.map((c) => c.id));
  const collections = [...ownedCollections, ...teamSpaces.filter((c) => !ownedIds.has(c.id))];

  return (
    <AppPage width="wide">
        <AppPageTitle
          title="My pages"
          lede={pages.length === 0 ? "" : pages.length === 1 ? "1 page" : `${pages.length} pages`}
          action={
            <Button variant="primary" size="lg" href={ROUTES.app}>
              Write a page
            </Button>
          }
        />

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
              source: p.last_source ?? null,
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
    </AppPage>
  );
}
