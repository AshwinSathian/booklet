import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { APP_NAME } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import { buildLockedPageMetadata } from "@/lib/locked-page-metadata";
import { getDoc } from "@/lib/storage";
import { getPageBySlug, getPageRecord } from "@/lib/db";
import { verifyUnlockToken } from "@/lib/unlock-token";
import { getTheme, themeScopeClass, themeStyleTagContent } from "@/lib/themes";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveEmbedPage(idOrSlug: string) {
  let doc = await getDoc(idOrSlug);
  let resolvedId = idOrSlug;
  let pageRecord = null;

  if (doc) {
    pageRecord = await getPageRecord(resolvedId).catch(() => null);
  } else {
    const slugRecord = await getPageBySlug(idOrSlug).catch(() => null);
    if (slugRecord) {
      doc = await getDoc(slugRecord.id);
      resolvedId = slugRecord.id;
      pageRecord = slugRecord;
    }
  }

  return { doc, resolvedId, pageRecord };
}

function extractTitle(blocks: { t: string; level?: number; inl?: unknown[] }[]): string | null {
  const h1 = blocks.find((b) => b.t === "heading" && b.level === 1);
  if (!h1 || !h1.inl) return null;
  function inlToText(inl: unknown[]): string {
    return inl
      .map((n: unknown) => {
        const node = n as { t: string; v?: string; c?: unknown[] };
        if (node.t === "text") return node.v ?? "";
        if (node.c) return inlToText(node.c);
        return "";
      })
      .join("");
  }
  return inlToText(h1.inl as unknown[]) || null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: idOrSlug } = await params;
  const { doc, pageRecord } = await resolveEmbedPage(idOrSlug);
  if (!doc) return buildMetadata({ title: "Not found", noIndex: true });

  // Locked pages: generic metadata only — see src/lib/locked-page-metadata.ts.
  // Must come before extractTitle() below touches real content.
  if (pageRecord?.password_hash) {
    return {
      ...buildLockedPageMetadata(`/p/${idOrSlug}/embed`),
      robots: { index: false, follow: false },
    };
  }

  const title = extractTitle(doc.blocks as Parameters<typeof extractTitle>[0]) ?? "Shared page";
  return {
    ...buildMetadata({ title, noIndex: true }),
    robots: { index: false, follow: false },
  };
}

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idOrSlug } = await params;
  const { doc, resolvedId, pageRecord } = await resolveEmbedPage(idOrSlug);

  if (!doc) {
    return (
      <div className="flex min-h-50 items-center justify-center bg-bg text-center p-8">
        <p className="text-sm text-text-muted">This page doesn&apos;t exist or was deleted.</p>
      </div>
    );
  }

  // Password-protected: show a placeholder in embeds
  if (pageRecord?.password_hash) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(`booklet_unlock_${resolvedId}`)?.value;
    const unlocked = await verifyUnlockToken(resolvedId, pageRecord.password_hash, cookieValue);
    if (!unlocked) {
      return (
        <div className="flex min-h-50 items-center justify-center bg-bg text-center p-8">
          <div>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className="mx-auto mb-3 text-text-muted"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-text-muted mb-3">This page is password protected.</p>
            <Link
              href={`/p/${idOrSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:text-accent-soft transition underline"
            >
              Open to unlock →
            </Link>
          </div>
        </div>
      );
    }
  }

  const maxW = doc.settings?.width === "wide" ? "max-w-4xl" : "max-w-3xl";
  const theme = getTheme(doc.settings?.theme);

  return (
    <div className={`bg-bg text-text-primary min-h-screen ${themeScopeClass(theme)}`}>
      <style dangerouslySetInnerHTML={{ __html: themeStyleTagContent(theme) }} />
      <main className={`mx-auto w-full px-5 py-8 ${maxW}`}>
        <BlockRenderer
          blocks={doc.blocks}
          settings={doc.settings}
          headingAnchors={undefined}
        />
      </main>

      {/* Minimal attribution footer — always shown in embeds */}
      <footer className="border-t border-border-subtle mt-4">
        <div className={`mx-auto w-full px-5 py-3 ${maxW} flex items-center justify-between gap-3`}>
          <span className="text-2xs text-text-muted">
            Published via {APP_NAME}
          </span>
          <Link
            href={`/p/${idOrSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-2xs text-accent hover:text-accent-soft transition"
          >
            Open full page →
          </Link>
        </div>
      </footer>
    </div>
  );
}

// Framing headers are set in src/middleware.ts for /p/*/embed routes.
// This page is server-rendered on every request (force-dynamic above).
