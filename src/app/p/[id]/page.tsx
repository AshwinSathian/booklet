import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { AppLogo, BookletMark } from "@/components/ui/AppLogo";
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
import { getTheme, themeScopeClass, themeStyleTagContent } from "@/lib/themes";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
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
import { ShareButtons } from "@/components/share/ShareButtons";
import { GoneNotice } from "@/components/share/GoneNotice";
import { KeepPageNotice } from "@/components/share/KeepPageNotice";
import { PURGE_GRACE_DAYS, claimCookieName, claimTokenMatches } from "@/lib/anonymous-claim";
import { getSession } from "@/lib/auth/session";
import { GONE_MESSAGES } from "@/lib/gone-notice";
import { getDocState } from "@/lib/storage";
import { getGoneReason } from "@/server/page-gone";

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

  // Taken down, or an expired anonymous page. The middleware normally
  // answers 410 before this renders; checking again here is what keeps the
  // content (and its title, in generateMetadata) hidden if that check ever
  // fails open. No catch: if this lookup itself fails, the request errors
  // rather than rendering content that may have been taken down.
  const gone = doc ? await getGoneReason(resolvedId) : null;

  return { doc, resolvedId, pageRecord, gone };
}

/**
 * The expiry date to show the author of an unclaimed anonymous page, or
 * null for everyone else — readers, and any page that has an owner.
 */
function formatNoticeDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

async function expiryForAuthor(resolvedId: string, hasOwner: boolean): Promise<Date | null> {
  if (hasOwner) return null;
  const state = await getDocState(resolvedId).catch(() => null);
  if (!state?.expiresAt) return null;
  const token = (await cookies()).get(claimCookieName(resolvedId))?.value;
  return (await claimTokenMatches(token, state.claimTokenHash)) ? state.expiresAt : null;
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
  const { doc, pageRecord, gone } = await resolveSharePage(idOrSlug);

  if (!doc) {
    return buildMetadata({
      title: "Not found",
      description: "This page doesn't exist, or the link is incorrect.",
      pathname: `/p/${idOrSlug}`,
      noIndex: true,
    });
  }

  if (gone) {
    return buildMetadata({
      title: "Page unavailable",
      description: GONE_MESSAGES[gone],
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

  // Indexable only when the author opted in. Anonymous publishes have no
  // `pages` record at all, so "not public" (rather than "is unlisted") is
  // what keeps them out of search engines too.
  const isPublic = pageRecord?.visibility === "public";
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
      noIndex: !isPublic,
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
  const { doc, resolvedId, pageRecord, gone } = await resolveSharePage(idOrSlug);

  // A real 404, rendered by ./not-found.tsx. Returning the notice from here
  // answered 200, so a deleted page looked alive to crawlers and scripts.
  if (!doc) notFound();
  // Null unless this browser published the page and nobody owns it yet.
  const expiresAt = await expiryForAuthor(resolvedId, pageRecord !== null);
  // An expired page is still shown to its author, with the notice below,
  // so it can be claimed before the purge deletes it.
  if (gone && !(gone === "expired" && expiresAt)) return <GoneNotice reason={gone} />;

  const viewerSignedIn = expiresAt ? (await getSession()) !== null : false;

  // Password gate: check cookie before revealing content.
  if (pageRecord?.password_hash) {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(`booklet_unlock_${resolvedId}`)?.value;
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
  // Anonymous publishes never get a `pages` record (see api/publish/route.ts),
  // so `pageRecord` is null for them — gating on visibility === "public"
  // silently hid these features from every anonymous page. The only real
  // reason to hide them is an intentionally password-locked page, which is
  // knowable without a pages record existing at all.
  const isNotPasswordLocked = !pageRecord?.password_hash;
  const theme = getTheme(doc.settings?.theme);

  return (
    <div className={`min-h-screen bg-bg text-text-primary ${themeScopeClass(theme)}`}>
      {/* Theme token overrides — theme is always resolved via getTheme(), a
          fixed developer-authored lookup; theme.id can never come directly
          from stored/request input, so this is safe to render verbatim. */}
      <style dangerouslySetInnerHTML={{ __html: themeStyleTagContent(theme) }} />
      <ReadingProgress />
      {expiresAt ? (
        <KeepPageNotice
          pageId={resolvedId}
          expiresOn={formatNoticeDate(expiresAt)}
          deletedOn={
            gone === "expired" ? formatNoticeDate(new Date(expiresAt.getTime() + PURGE_GRACE_DAYS * 86_400_000)) : null
          }
          signedIn={viewerSignedIn}
        />
      ) : null}
      <AnalyticsBeacon pageId={resolvedId} />

      {/* ── Sticky header ── */}
      <StickyHeader
        compact={
          <div className={`mx-auto w-full px-4 py-2 flex items-center justify-between gap-3 ${maxW}`}>
            <AppLogo onlyIcon={true} />
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <ExportMenu blocks={doc.blocks} settings={doc.settings} raw={doc.raw} title={pageTitle} />
              <ThemeToggle />
              <Button variant="primary" size="md" href={ROUTES.app} data-booklet-cta="make-your-own" className="hidden xs:inline-flex">
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
              data-booklet-cta="make-your-own"
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
            {isNotPasswordLocked && (
              <ShareButtons url={pageUrl} title={pageTitle} />
            )}
          </div>
          {showToc ? <DesktopTocClient toc={toc} /> : null}
        </div>

      </main>

      {/* ── Footer colophon ── */}
      <footer className="mt-12 border-t border-border-subtle print:hidden">
        <div className={`mx-auto w-full px-4 py-8 ${maxW}`}>
          {/* Colophon row — always shown, for all pages. */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BookletMark size={20} />
              <div>
                <div className="text-xs font-semibold text-text-primary">{APP_NAME}</div>
                <div className="text-2xs text-text-muted">
                  Published {createdAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  {readMins > 0 && <> · ~{readMins} min read</>}
                </div>
              </div>
            </div>
            <Link
              href={`/report?page=${encodeURIComponent(resolvedId)}`}
              rel="nofollow"
              className="text-2xs text-text-muted underline-offset-2 transition hover:text-text-secondary hover:underline sm:ml-auto"
            >
              Report this page
            </Link>
            <Link
              href={ROUTES.app}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border-default px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
            >
              Write your own page
              <svg width="10" height="10" fill="none" viewBox="0 0 12 12" aria-hidden>
                <path d="M2.5 9.5 9.5 2.5M9.5 2.5H4M9.5 2.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
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
