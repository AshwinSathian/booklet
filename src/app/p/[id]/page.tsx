import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { AppLogo } from "@/components/ui/AppLogo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import type { Block } from "@/lib/blocks";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { getPageBySlug, getPageRecord, incrementViewCount } from "@/lib/db";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { buildLockedPageMetadata } from "@/lib/locked-page-metadata";
import { getDoc } from "@/lib/storage";
import { readingTimeMinutes } from "@/lib/reading-time";
import { buildToc, MIN_TOC_HEADINGS } from "@/lib/toc";
import { verifyUnlockToken } from "@/lib/unlock-token";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { getClientIp } from "@/lib/request-ip";
import { hashSession } from "@/lib/session-hash";
import { Button } from "@/components/ui/Button";
import { DesktopTocClient, MobileTocClient } from "@/components/share/TocClient";
import { ExportMenu } from "@/components/share/ExportMenu";
import { AnalyticsBeacon } from "@/components/share/AnalyticsBeacon";
import { ReadingProgress } from "@/components/share/ReadingProgress";
import { PasswordGate } from "@/components/share/PasswordGate";
import { EmbedButton } from "@/components/share/EmbedButton";
import { StickyHeader } from "@/components/share/StickyHeader";
import { Reactions } from "@/components/share/Reactions";
import { ShareButtons } from "@/components/share/ShareButtons";
import { ScrollCta } from "@/components/share/ScrollCta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Resolve id-or-slug → { doc, resolvedId, pageRecord }
// ---------------------------------------------------------------------------

async function resolveSharePage(idOrSlug: string) {
  let doc = null;
  let resolvedId = idOrSlug;
  let pageRecord = null;

  doc = await getDoc(idOrSlug);

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

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: idOrSlug } = await params;
  const { doc, pageRecord } = await resolveSharePage(idOrSlug);

  if (!doc) {
    return buildMetadata({
      title: "Not found",
      description: "This page doesn't exist or it has expired.",
      pathname: `/p/${idOrSlug}`,
      noIndex: true,
    });
  }

  // Locked pages: return generic, non-identifying metadata and never touch
  // the real title/description/images below. generateMetadata() runs
  // regardless of the page component's own password gate (see
  // src/lib/locked-page-metadata.ts for the full rationale), so this check
  // must come before any of the real-content extraction that follows.
  if (pageRecord?.password_hash) {
    return buildLockedPageMetadata(`/p/${idOrSlug}`);
  }

  const isUnlisted = pageRecord?.visibility === "unlisted";
  const title = extractTitle(doc.blocks) ?? "Shared page";
  const fmMeta = pageRecord?.frontmatter_meta as Record<string, unknown> | null | undefined;
  const fmDescription = typeof fmMeta?.description === "string" ? fmMeta.description : null;
  const description = fmDescription ?? extractDescription(doc.blocks);

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
  const { doc, resolvedId, pageRecord } = await resolveSharePage(idOrSlug);

  if (!doc) return <NotFoundOrExpired />;

  // Password gate: check cookie before revealing content.
  if (pageRecord?.password_hash) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(`readable_unlock_${resolvedId}`)?.value;
    const unlocked = await verifyUnlockToken(resolvedId, pageRecord.password_hash, cookieValue);
    if (!unlocked) {
      return <PasswordGate pageId={resolvedId} />;
    }
  }

  // Fire-and-forget view count — non-blocking, non-fatal. Deduped per
  // session (see incrementViewCount) so reloads/bot re-fetches from the
  // same visitor don't keep inflating it.
  void (async () => {
    const hdrs = await headers();
    const ip = getClientIp(hdrs);
    const sessionHash = await hashSession(ip, hdrs.get("user-agent") ?? "");
    await incrementViewCount(resolvedId, sessionHash);
  })().catch(() => {});


  const createdAt = new Date(doc.createdAt);
  const { toc, anchorMap } = buildToc(doc.blocks ?? []);
  const showToc = toc.length >= MIN_TOC_HEADINGS;
  // anchorMap is always populated so all headings get IDs regardless of TOC visibility
  const maxW = doc.settings?.width === "wide" ? "max-w-4xl" : "max-w-3xl";
  const pageTitle = extractTitle(doc.blocks) ?? "Shared page";
  const readMins = readingTimeMinutes(doc.blocks ?? []);

  const pageUrl = absoluteUrl(`/p/${pageRecord?.slug ?? resolvedId}`);
  const isPublic = pageRecord?.visibility === "public";

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <ReadingProgress />
      <AnalyticsBeacon pageId={resolvedId} />
      {isPublic && <ScrollCta href={ROUTES.app} />}

      {/* ── Sticky header ── */}
      <StickyHeader
        compact={
          <div className={`mx-auto w-full px-4 py-2 flex items-center justify-between gap-3 ${maxW}`}>
            <AppLogo onlyIcon={true} />
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <ExportMenu blocks={doc.blocks} settings={doc.settings} raw={doc.raw} title={pageTitle} />
              <ThemeToggle />
              <Button variant="primary" size="md" href={ROUTES.app} data-readable-cta="make-your-own" className="hidden xs:inline-flex">
                <span className="hidden sm:inline">Write</span>
                <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
                  <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Button>
            </div>
          </div>
        }
      >
        <div className={`mx-auto w-full px-4 py-3 flex items-center justify-between gap-3 ${maxW}`}>
          <AppLogo onlyIcon={false} />

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Read time — desktop only */}
            <span className="hidden md:inline text-2xs text-text-muted tabular-nums">
              ~{readMins} min
            </span>
            <ExportMenu
              blocks={doc.blocks}
              settings={doc.settings}
              raw={doc.raw}
              title={pageTitle}
            />
            <EmbedButton
              pageId={resolvedId}
              title={pageTitle}
              baseUrl={absoluteUrl("")}
            />
            <ThemeToggle />
            {/* Make your own — visible at sm+ as button, at xs as icon only */}
            <Button
              variant="primary"
              size="md"
              href={ROUTES.app}
              data-readable-cta="make-your-own"
              className="hidden xs:inline-flex"
            >
              <span className="hidden sm:inline">Make your own</span>
              <span className="sm:hidden">Write</span>
              <svg width="11" height="11" fill="none" viewBox="0 0 11 11" aria-hidden>
                <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </div>
        </div>
      </StickyHeader>

      {/* ── Main content ── */}
      <main className={`mx-auto w-full px-4 py-6 sm:py-8 ${maxW}`}>
        {showToc ? <MobileTocClient toc={toc} /> : null}

        <div className="flex flex-col lg:flex-row gap-12">
          <div className="min-w-0 flex-1">
            <FrontmatterMetaStrip
              meta={pageRecord?.frontmatter_meta ?? null}
              userId={pageRecord?.user_id ?? null}
            />
            <BlockRenderer
              blocks={doc.blocks}
              settings={doc.settings}
              headingAnchors={anchorMap}
            />
            {isPublic && <Reactions pageId={resolvedId} />}
            {isPublic && (
              <ShareButtons url={pageUrl} title={pageTitle} />
            )}
          </div>
          {showToc ? <DesktopTocClient toc={toc} /> : null}
        </div>

      </main>

      {/* ── Footer colophon ── */}
      <footer className="mt-12 border-t border-border-subtle print:hidden">
        <div className={`mx-auto w-full px-4 py-8 ${maxW}`}>
          {/* Colophon row. The branded half (logo/app-name/CTA) is the actual
              "Made with Readable" attribution and respects
              remove_attribution_badge (signed-in pages default to no badge,
              anonymous pages always show it, either can toggle per-page via
              PATCH — see PAYWALL_HISTORY.md). Publish date / read time is
              genuinely useful reader info, independent of attribution, so it
              stays either way. */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {!pageRecord?.remove_attribution_badge && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
                  <rect width="24" height="24" rx="5.5" fill="var(--color-accent)" />
                  <path
                    d="M 6.5 5 L 6.5 19 M 6.5 5 L 13 5 Q 17 5 17 9 Q 17 13 13 13 L 6.5 13 M 11.5 13 L 17 19"
                    stroke="white"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              <div>
                {!pageRecord?.remove_attribution_badge && (
                  <div className="text-xs font-semibold text-text-primary">{APP_NAME}</div>
                )}
                <div className="text-2xs text-text-muted">
                  Published {createdAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  {readMins > 0 && <> · ~{readMins} min read</>}
                </div>
              </div>
            </div>
            {!pageRecord?.remove_attribution_badge && (
              <Link
                href={ROUTES.app}
                className="inline-flex items-center gap-1.5 rounded-pill border border-outline px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
              >
                Write your own page
                <svg width="10" height="10" fill="none" viewBox="0 0 12 12" aria-hidden>
                  <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Frontmatter metadata strip
// ---------------------------------------------------------------------------

function FrontmatterMetaStrip({
  meta,
  userId,
}: {
  meta: Record<string, unknown> | null;
  userId: string | null;
}) {
  if (!meta) return null;

  const author = typeof meta.author === "string" ? meta.author : null;
  const dateRaw = typeof meta.date === "string" ? meta.date : null;
  const tags = Array.isArray(meta.tags) ? (meta.tags as unknown[]).filter((t): t is string => typeof t === "string") : [];

  if (!author && !dateRaw && tags.length === 0) return null;

  let formattedDate: string | null = null;
  if (dateRaw) {
    try {
      formattedDate = new Date(dateRaw).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      formattedDate = dateRaw;
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-secondary print:mb-4">
      {author && (
        <span>
          by{" "}
          {userId ? (
            <Link
              href={`/u/${userId}`}
              className="font-medium text-text-primary transition hover:text-accent"
            >
              {author}
            </Link>
          ) : (
            <span className="font-medium text-text-primary">{author}</span>
          )}
        </span>
      )}
      {formattedDate && (
        <span className="text-text-muted">{formattedDate}</span>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Link
              key={tag}
              href={`/tags/${encodeURIComponent(tag)}`}
              className="rounded-pill bg-accent-dim text-accent text-xs px-2 py-0.5 font-medium transition hover:bg-accent/20 hover:text-accent"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}
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

          <h1 className="text-xl font-medium">This page doesn&apos;t exist.</h1>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            The link may be wrong, or the page may have been deleted by its author.
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
