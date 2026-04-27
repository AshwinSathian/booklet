import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";
import { getPagesByUser } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { headers } from "next/headers";
import { MyPagesList } from "./MyPagesClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "My pages — Readable" };

function getBaseUrl(req: Headers): string {
  const host = req.get("host") ?? "readable.page";
  const proto = req.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export default async function MyPagesPage() {
  const { userId } = await auth();
  // Middleware guarantees userId is set; this is a safety guard.
  if (!userId) {
    return null;
  }

  const hdrs = await headers();
  const baseUrl = getBaseUrl(hdrs);
  const pages = await getPagesByUser(userId);

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-3xl px-4 h-12 flex items-center justify-between gap-4">
          <Link href={ROUTES.home}>
            <AppLogo onlyIcon={false} />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={ROUTES.app}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-pill border border-outline px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
            >
              Back to editor
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">My pages</h1>
            <p className="mt-0.5 text-sm text-text-secondary">
              {pages.length === 0
                ? "No published pages yet."
                : pages.length === 1
                  ? "1 published page"
                  : `${pages.length} published pages`}
            </p>
          </div>
          <Link
            href={ROUTES.app}
            className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover shrink-0"
          >
            + New page
          </Link>
        </div>

        <MyPagesList
          initialPages={pages.map((p) => ({
            id: p.id,
            view_count: p.view_count,
            created_at: p.created_at,
            updated_at: p.updated_at,
          }))}
          baseUrl={baseUrl}
        />
      </main>
    </div>
  );
}
