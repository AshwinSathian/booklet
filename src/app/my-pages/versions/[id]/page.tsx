import { AppPage, AppPageTitle } from "@/components/app/AppPage";
import { ROUTES } from "@/lib/constants";
import { getPageRecord } from "@/lib/db";
import { getPageVersions } from "@/lib/db/versions";
import { extractDocTitle } from "@/lib/doc-title";
import { getDoc } from "@/lib/storage";
import { getSession } from "@/lib/auth/session";
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
    <AppPage width="medium">
        <AppPageTitle back={{ href: ROUTES.myPages, label: "My pages" }} eyebrow="Version history" title={title} />

        <VersionsClient
          pageId={id}
          versions={versions.map((version) => ({
            version_number: version.version_number,
            created_at: version.created_at,
            size_bytes: version.size_bytes,
          }))}
        />
    </AppPage>
  );
}
