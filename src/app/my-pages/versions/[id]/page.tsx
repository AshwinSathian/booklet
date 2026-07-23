import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";
import { getPageRecord } from "@/lib/db";
import { getPageVersions } from "@/lib/db/versions";
import { extractDocTitle } from "@/lib/doc-title";
import { getDoc } from "@/lib/storage";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VersionsClient } from "./VersionsClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Version history — Booklet",
  robots: { index: false, follow: false },
};

export default async function PageVersionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return null;

  const { id } = await params;
  const page = await getPageRecord(id);
  if (!page || page.user_id !== userId) notFound();

  const [versions, doc] = await Promise.all([
    getPageVersions(id),
    getDoc(id).catch(() => null),
  ]);

  const title = page.title ?? (doc ? extractDocTitle(doc.blocks) : null) ?? "Untitled page";

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-12 w-full max-w-4xl items-center justify-between gap-4 px-4">
          <AppLogo onlyIcon={false} />
          <Link
            href={ROUTES.myPages}
            className="inline-flex items-center rounded-pill border border-outline px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
          >
            Back to My pages
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="mb-5">
          <p className="text-xs text-text-muted">Version history</p>
          <h1 className="mt-1 truncate text-[clamp(20px,3vw,26px)]">{title}</h1>
        </div>

        <VersionsClient
          pageId={id}
          versions={versions.map((version) => ({
            version_number: version.version_number,
            created_at: version.created_at,
            size_bytes: version.size_bytes,
          }))}
        />
      </main>
    </div>
  );
}
