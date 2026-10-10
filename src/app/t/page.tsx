import { AppLogo } from "@/components/ui/AppLogo";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { ROUTES } from "@/lib/constants";
import { getCollectionsByUser, getTeamSpacesByMembership } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CreateSpaceForm } from "./CreateSpaceForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Spaces — Booklet", robots: { index: false, follow: false } };

export default async function SpacesPage() {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) redirect(ROUTES.signIn);

  const [owned, joined] = await Promise.all([
    getCollectionsByUser(userId).then((cs) => cs.filter((c) => c.is_team_space)),
    getTeamSpacesByMembership(userId),
  ]);
  const ownedIds = new Set(owned.map((c) => c.id));
  // A space without a slug has no /t/<slug> home to link to.
  const spaces = [...owned, ...joined.filter((c) => !ownedIds.has(c.id))].filter((c) => c.slug);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="border-b border-border-subtle bg-bg/85 backdrop-blur-xl sticky top-0 z-20">
        <div className="mx-auto w-full max-w-3xl px-4 h-12 flex items-center justify-between gap-4">
          <AppLogo onlyIcon={false} />
          <AccountMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="text-xl font-medium">Spaces</h1>
        <p className="mt-1 text-sm text-text-secondary">
          A space is where a team keeps its incident reports, decisions, RFCs and runbooks. Members can read
          every page in it, including the ones marked team-only.
        </p>

        {spaces.length > 0 && (
          <ul className="mt-8 divide-y divide-border-subtle border-y border-border-subtle">
            {spaces.map((space) => (
              <li key={space.id}>
                <Link
                  href={ROUTES.space(space.slug as string)}
                  className="flex items-center justify-between gap-4 py-3 text-sm transition hover:bg-fill-1"
                >
                  <span className="font-medium text-text-primary">{space.name}</span>
                  <span className="text-2xs text-text-muted">{ownedIds.has(space.id) ? "Owner" : "Member"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-10" aria-labelledby="create-space">
          <h2 id="create-space" className="text-sm font-medium">
            Create a space
          </h2>
          <CreateSpaceForm />
        </section>
      </main>
    </div>
  );
}
