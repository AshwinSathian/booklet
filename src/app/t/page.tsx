import { AppPage, AppPageTitle } from "@/components/app/AppPage";
import { ROUTES } from "@/lib/constants";
import { getCollectionsByUser, getTeamSpacesByMembership } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CreateSpaceForm } from "./CreateSpaceForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Spaces · Booklet", robots: { index: false, follow: false } };

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
    <AppPage>
        <AppPageTitle
          title="Spaces"
          lede="A space is where a team keeps its incident reports, decisions, RFCs and runbooks. Members can read every page in it, including the ones marked Team only."
        />

        {spaces.length > 0 && (
          <ul className="divide-y divide-border-default border-y border-border-default">
            {spaces.map((space) => (
              <li key={space.id}>
                <Link
                  href={ROUTES.space(space.slug as string)}
                  className="group flex items-center justify-between gap-4 py-3.5 text-sm"
                >
                  <span className="font-medium text-text-primary underline-offset-3 group-hover:underline">{space.name}</span>
                  <span className="text-xs text-text-muted">{ownedIds.has(space.id) ? "Owner" : "Member"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section className="mt-10" aria-labelledby="create-space">
          <h2 id="create-space" className="text-[0.9375rem] font-semibold">
            Create a space
          </h2>
          <CreateSpaceForm />
        </section>
    </AppPage>
  );
}
