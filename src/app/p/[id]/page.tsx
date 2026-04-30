import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { AppLogo } from "@/components/ui/AppLogo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import type { Block } from "@/lib/blocks";
import { APP_NAME, ROUTES, STORAGE } from "@/lib/constants";
import { getPageBySlug, getPageRecord, incrementViewCount } from "@/lib/db";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { getDoc } from "@/lib/storage";
import { QuotaExceededError } from "@/lib/quota";
import { readingTimeMinutes } from "@/lib/reading-time";
import { buildToc, MIN_TOC_HEADINGS, type TocItem } from "@/lib/toc";
import type { Metadata } from "next";
import Link from "next/link";
import { DesktopTocClient, MobileTocClient } from "@/components/share/TocClient";
import { ExportMenu } from "@/components/share/ExportMenu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Resolve id-or-slug → { doc, resolvedId, pageRecord }
// ---------------------------------------------------------------------------

async function resolveSharePage(idOrSlug: string) {
  let doc = null;
  let resolvedId = idOrSlug;
  let pageRecord = null;
  let quotaExceeded = false;

  try {
    // Fast path: direct KV lookup by 10-char ID.
    doc = await getDoc(idOrSlug);
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return { doc: null, resolvedId, pageRecord: null, quotaExceeded: true };
    }
    throw e;
  }

  if (doc) {
    pageRecord = await getPageRecord(resolvedId).catch(() => null);
  } else {
    const slugRecord = await getPageBySlug(idOrSlug).catch(() => null);
    if (slugRecord) {
      try {
        doc = await getDoc(slugRecord.id);
      } catch (e) {
        if (e instanceof QuotaExceededError) {
          return { doc: null, resolvedId, pageRecord: null, quotaExceeded: true };
        }
        throw e;
      }
      resolvedId = slugRecord.id;
      pageRecord = slugRecord;
    }
  }

  return { doc, resolvedId, pageRecord, quotaExceeded };
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: idOrSlug } = await params;
  const { doc, pageRecord, quotaExceeded } = await resolveSharePage(idOrSlug);

  if (quotaExceeded) {
    return buildMetadata({
      title: "Service temporarily unavailable",
      description: "Readable is temporarily unavailable. Please try again later.",
      pathname: `/p/${idOrSlug}`,
      noIndex: true,
    });
  }

  if (!doc) {
    return buildMetadata({
      title: "Not found",
      description: "This page doesn't exist or it has expired.",
      pathname: `/p/${idOrSlug}`,
      noIndex: true,
    });
  }

  const isUnlisted = pageRecord?.visibility === "unlisted";
  const title = extractTitle(doc.blocks) ?? "Shared page";
  const description = extractDescription(doc.blocks);

  const titleParam = encodeURIComponent(title);
  const ogImage = absoluteUrl(`/opengraph-image?title=${titleParam}`);
  const twImage = absoluteUrl(`/twitter-image?title=${titleParam}`);

  return {
    ...buildMetadata({
      title,
      description,
      pathname: `/p/${idOrSlug}`,
      noIndex: isUnlisted,
    }),
    openGraph: {
      type: "article",
      siteName: APP_NAME,
      title: `${title} — ${APP_NAME}`,
      description,
      url: absoluteUrl(`/p/${idOrSlug}`),
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${APP_NAME}`,
      description,
      images: [{ url: twImage, width: 1200, height: 630, alt: title }],
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idOrSlug } = await params;
  const { doc, resolvedId, pageRecord, quotaExceeded } = await resolveSharePage(idOrSlug);

  if (quotaExceeded) return <ServiceUnavailable />;
  if (!doc) return <NotFoundOrExpired />;

  // Fire-and-forget view count — non-blocking, non-fatal.
  void incrementViewCount(resolvedId).catch(() => {});

  // Permanent pages (owned, in D1) don't expire.
  const isPermanent = pageRecord !== null;
  const createdAt = new Date(doc.createdAt);
  const daysLeft = isPermanent
    ? null
    : Math.ceil(
        (new Date(createdAt.getTime() + STORAGE.ttlSeconds * 1000).getTime() - Date.now()) /
          86_400_000,
      );

  const { toc, anchorMap } = buildToc(doc.blocks ?? []);
  const showToc = toc.length >= MIN_TOC_HEADINGS;
  // anchorMap is always populated so all headings get IDs regardless of TOC visibility
  const maxW = doc.settings?.width === "wide" ? "max-w-4xl" : "max-w-3xl";
  const pageTitle = extractTitle(doc.blocks) ?? "Shared page";
  const readMins = readingTimeMinutes(doc.blocks ?? []);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl print:hidden">
        <div className={`mx-auto w-full px-4 py-3 flex items-center justify-between gap-4 ${maxW}`}>
          <AppLogo onlyIcon={false} />

          <div className="flex items-center gap-2 shrink-0">
            {daysLeft !== null && <ExpiryBadge daysLeft={daysLeft} />}
            <span className="hidden sm:inline text-2xs text-text-muted">
              ~{readMins} min read
            </span>
            <ExportMenu
              blocks={doc.blocks}
              settings={doc.settings}
              raw={doc.raw}
              title={pageTitle}
            />
            <ThemeToggle />
            <Link
              href={ROUTES.app}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-pill bg-accent px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-hover"
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
            <BlockRenderer
              blocks={doc.blocks}
              settings={doc.settings}
              headingAnchors={anchorMap}
            />
          </div>
          {showToc ? <DesktopTocClient toc={toc} /> : null}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="mt-12 border-t border-border-subtle print:hidden">
        <div className={`mx-auto w-full px-4 py-6 ${maxW}`}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
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
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-pill border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-2xs font-medium text-red-400">
        Expired
      </span>
    );
  }

  if (daysLeft <= 7) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 rounded-pill border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-2xs font-medium text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
        Expires in {daysLeft} {daysLeft === 1 ? "day" : "days"}
      </span>
    );
  }

  return (
    <span className="hidden sm:inline-flex items-center rounded-pill border border-border-default px-2.5 py-0.5 text-2xs text-text-muted">
      Expires in {daysLeft} days
    </span>
  );
}

// ---------------------------------------------------------------------------
// Service unavailable (quota exceeded)
// ---------------------------------------------------------------------------

function ServiceUnavailable() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <AppLogo onlyIcon={false} />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-sm">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-card bg-amber-400/10 text-amber-400">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <h1 className="text-lg font-semibold">Temporarily unavailable</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Readable has reached its free-tier daily limit. We&apos;re in beta and this
            resets automatically at midnight UTC. Please check back shortly.
          </p>
          <Link
            href={ROUTES.home}
            className="mt-6 inline-flex items-center gap-1.5 rounded-pill border border-border-default px-5 py-2.5 text-sm font-semibold transition hover:bg-fill-2"
          >
            Go home
          </Link>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Not found / expired
// ---------------------------------------------------------------------------

const EXAMPLE_PAGES = [
  { label: "Incident Report", href: "https://readable.ashwinsathian.com/p/GqfTrJQg0t" },
  { label: "Architecture Decision Record", href: "https://readable.ashwinsathian.com/p/Vmm78unhPg" },
  { label: "Technical Docs", href: "https://readable.ashwinsathian.com/p/6MTZfx3M6q" },
] as const;

function NotFoundOrExpired() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <AppLogo onlyIcon={false} />
        </div>
      </header>

      <main className="flex-1 px-4 py-16">
        <div className="mx-auto max-w-xl">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-card bg-fill-2 text-text-muted">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="4" y="2" width="16" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="text-xl font-semibold">This page has expired or doesn&apos;t exist</h1>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            Anonymous pages expire after 30 days. Sign in to publish permanent pages that never expire.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={ROUTES.app}
              className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.97]"
            >
              Create a page
              <svg width="11" height="11" fill="none" viewBox="0 0 12 12" aria-hidden>
                <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/?#examples"
              className="inline-flex items-center gap-1.5 rounded-pill border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition hover:text-text-primary hover:bg-fill-2"
            >
              Browse examples
            </Link>
          </div>

          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Example pages</p>
            <div className="flex flex-col gap-2">
              {EXAMPLE_PAGES.map((ex) => (
                <a
                  key={ex.href}
                  href={ex.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-border-subtle px-4 py-3 text-sm text-text-secondary transition hover:border-accent-soft/40 hover:text-text-primary hover:bg-fill-1 group"
                >
                  <span>{ex.label}</span>
                  <svg width="12" height="12" fill="none" viewBox="0 0 12 12" className="text-text-muted group-hover:text-accent transition" aria-hidden>
                    <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Static params
// ---------------------------------------------------------------------------

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

// ---------------------------------------------------------------------------
// Metadata helpers (local — also used by generateMetadata above)
// ---------------------------------------------------------------------------

function extractTitle(blocks: Block[]): string | null {
  for (const b of blocks ?? []) {
    if (b?.t === "heading" && ((b as { level?: number }).level === 1 || (b as { level?: number }).level === 2)) {
      const t = inlineToText((b as Record<string, unknown>).inl);
      if (t) return clamp(t, 64);
    }
  }
  return null;
}

function extractDescription(blocks: Block[]): string {
  for (const b of blocks ?? []) {
    if (b?.t === "paragraph") {
      const t = inlineToText((b as Record<string, unknown>).inl);
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
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "…";
}
