import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { AppLogo } from "@/components/ui/AppLogo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import type { Block } from "@/lib/blocks";
import { APP_NAME, ROUTES, STORAGE } from "@/lib/constants";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { getDoc } from "@/lib/storage";
import { buildToc, MIN_TOC_HEADINGS, type TocItem } from "@/lib/toc";
import type { Metadata } from "next";
import Link from "next/link";
import { Skeleton } from "primereact/skeleton";
import { DesktopTocClient, MobileTocClient } from "@/components/share/TocClient";
import { PrintButton } from "@/components/share/PrintButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const doc = await getDoc(id);

  if (!doc) {
    return buildMetadata({
      title: "Not found",
      description: "This page doesn't exist or it has expired.",
      pathname: `/p/${id}`,
      noIndex: true,
    });
  }

  const title = extractTitle(doc.blocks) ?? "Shared page";
  const description = extractDescription(doc.blocks);

  const ogImage = absoluteUrl("/opengraph-image");
  const twImage = absoluteUrl("/twitter-image");

  return {
    ...buildMetadata({
      title,
      description,
      pathname: `/p/${id}`,
      noIndex: false,
    }),
    openGraph: {
      type: "article",
      siteName: APP_NAME,
      title: `${title} — ${APP_NAME}`,
      description,
      url: absoluteUrl(`/p/${id}`),
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${APP_NAME} preview` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${APP_NAME}`,
      description,
      images: [{ url: twImage, width: 1200, height: 630, alt: `${APP_NAME} preview` }],
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDoc(id);

  if (!doc) return <NotFoundOrExpired />;

  const createdAt = new Date(doc.createdAt);
  const expiresAt = new Date(createdAt.getTime() + STORAGE.ttlSeconds * 1000);
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000);

  const { toc, anchorMap } = buildToc(doc.blocks ?? []);
  const showToc = toc.length >= MIN_TOC_HEADINGS;

  const maxW = doc.settings?.width === "wide" ? "max-w-4xl" : "max-w-3xl";

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 border-b border-outline/70 bg-bg/85 backdrop-blur-xl print:hidden">
        <div className={`mx-auto w-full px-4 py-3 flex items-center justify-between gap-4 ${maxW}`}>
          <AppLogo onlyIcon={false} />

          <div className="flex items-center gap-2 shrink-0">
            {/* Expiry badge */}
            <ExpiryBadge daysLeft={daysLeft} />

            <PrintButton />

            <ThemeToggle />

            {/* "Make your own" CTA */}
            <Link
              href={ROUTES.app}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-accent-hover"
            >
              Make your own
              <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
                <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className={`mx-auto w-full flex-1 min-h-0 px-4 py-8 ${maxW}`}>
        {showToc ? <MobileTocClient toc={toc} /> : null}

        <div className="flex flex-col lg:flex-row gap-12">
          <div className="min-w-0 flex-1">
            {doc?.blocks ? (
              <BlockRenderer
                blocks={doc.blocks}
                settings={doc.settings}
                headingAnchors={anchorMap}
              />
            ) : (
              [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <Skeleton key={n} className="my-2 w-full" />
              ))
            )}
          </div>

          {showToc ? <DesktopTocClient toc={toc} /> : null}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-12 border-t border-outline/50 print:hidden">
        <div className={`mx-auto w-full px-4 py-6 ${maxW}`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-text-muted">
            <div className="flex items-center gap-2">
              <AppLogo onlyIcon={true} />
              <span>Published via {APP_NAME}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>
                Published {createdAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </span>
              <Link href={ROUTES.app} className="text-accent transition hover:text-accent-soft">
                Create your own →
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expiry badge
// ---------------------------------------------------------------------------

function ExpiryBadge({ daysLeft }: { daysLeft: number }) {
  if (daysLeft <= 0) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-medium text-red-400">
        Expired
      </span>
    );
  }

  if (daysLeft <= 7) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Expires in {daysLeft} {daysLeft === 1 ? "day" : "days"}
      </span>
    );
  }

  return (
    <span className="hidden sm:inline-flex items-center rounded-full border border-outline/60 px-2.5 py-0.5 text-[10px] text-text-muted">
      Expires in {daysLeft} days
    </span>
  );
}

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

function NotFoundOrExpired() {
  return (
    <main className="w-screen h-screen flex items-center justify-center bg-bg text-text-primary">
      <div className="p-8 text-center flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-outline/30 text-2xl">
          🔍
        </div>
        <div>
          <div className="text-[16px] font-semibold">Page not found</div>
          <div className="mt-1 text-[13px] text-text-secondary">
            This page doesn&apos;t exist or has expired after 30 days.
          </div>
        </div>
        <Link
          href={ROUTES.app}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-accent-hover"
        >
          Create a Readable page
          <svg width="12" height="12" fill="none" viewBox="0 0 12 12" aria-hidden>
            <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <AppLogo onlyIcon={false} />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

// ---------------------------------------------------------------------------
// Metadata helpers
// ---------------------------------------------------------------------------

function extractTitle(blocks: Block[]): string | null {
  for (const b of blocks ?? []) {
    if (b?.t === "heading" && (b?.level === 1 || b?.level === 2)) {
      const t = inlineToText((b as any)?.inl);
      if (t) return clamp(t, 64);
    }
  }
  return null;
}

function extractDescription(blocks: Block[]): string {
  for (const b of blocks ?? []) {
    if (b?.t === "paragraph") {
      const t = inlineToText((b as any)?.inl);
      if (t) return clamp(t, 160);
    }
  }
  return "A clean, readable share page.";
}

function inlineToText(inl: unknown): string {
  if (!inl) return "";
  if (Array.isArray(inl)) return inl.map(inlineToText).join("").trim();
  if (typeof inl === "string") return inl;
  if (typeof inl !== "object" || inl === null) return "";
  const o = inl as Record<string, unknown>;
  if (o.t === "text" || o.t === "code") return String(o.v ?? "");
  if (o.t === "link") return inlineToText(o.c);
  if (o.t === "strong" || o.t === "em") return inlineToText(o.c);
  return "";
}

function clamp(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
}
