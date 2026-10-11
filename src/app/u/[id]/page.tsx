import { PageCard } from "@/app/explore/ExploreClient";
import { Avatar } from "@/components/auth/AccountMenu";
import { Container, PageShell, PageTitle } from "@/components/marketing/primitives";
import { getPublicPagesByUser } from "@/lib/db";
import { getUserById } from "@/lib/db/auth";
import type { DbUser } from "@/lib/db/types";
import { APP_NAME } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import type { ExploreItem } from "@/lib/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function displayName(user: DbUser): string {
  return user.display_name?.trim() || "Booklet user";
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
    <PageShell>
      <Container className="py-14 sm:py-20">
        <div className="flex items-center gap-5">
          <Avatar initials={initials} className="h-16 w-16 font-display text-xl" />
          <PageTitle
            title={name}
            lede={pages.length > 0 ? `${pages.length} public ${pages.length === 1 ? "page" : "pages"}` : undefined}
          />
        </div>
        {pages.length > 0 ? (
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => (
              <PageCard key={page.id} page={page} />
            ))}
          </div>
        ) : (
          <p className="mt-6 text-lg text-text-secondary">No public pages yet.</p>
        )}
      </Container>
    </PageShell>
  );
}

export async function generateStaticParams() {
  return [];
}
