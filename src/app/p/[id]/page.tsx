import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { APP_NAME, ROUTES, STORAGE } from "@/lib/constants";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { getDoc } from "@/lib/storage";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "primereact/button";
import { Skeleton } from "primereact/skeleton";

export const runtime = "nodejs";

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
      description: "This page doesn’t exist or it has expired.",
      pathname: `/p/${id}`,
      noIndex: true,
    });
  }

  const title = extractTitle(doc.blocks) ?? "Shared page";
  const description = extractDescription(doc.blocks);

  // Force explicit, absolute images (prevents localhost leaks and satisfies Meta).
  const ogImage = absoluteUrl("/opengraph-image");
  const twImage = absoluteUrl("/twitter-image");

  return {
    ...buildMetadata({
      title,
      description,
      pathname: `/p/${id}`,
      // Indexable by default for share pages (you can set noIndex true if needed)
      noIndex: false,
    }),
    openGraph: {
      type: "article",
      siteName: APP_NAME,
      title: `${title} — ${APP_NAME}`,
      description,
      url: absoluteUrl(`/p/${id}`),
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${APP_NAME} preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${APP_NAME}`,
      description,
      images: [
        {
          url: twImage,
          width: 1200,
          height: 630,
          alt: `${APP_NAME} preview`,
        },
      ],
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
  if (!doc) return notFound();

  const createdAt = new Date(doc.createdAt);
  const expiresAt = new Date(createdAt.getTime() + STORAGE.ttlSeconds * 1000);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="sticky top-0 z-20 border-b border-outline bg-bg-glass/85 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="leading-tight uppercase min-w-0">
            <Link href={ROUTES.home}>
              <div className="font-semibold tracking-wide">{APP_NAME}</div>
            </Link>
            <div className="hidden sm:inline-flex text-xs text-[rgb(var(--muted))] tracking-widest">
              Paste. Preview. Share.
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:block text-right text-[11px] text-[rgb(var(--muted))] uppercase tracking-widest">
              <div>Published {createdAt.toLocaleString()}</div>
              <div>Expires {formatRelative(expiresAt)}</div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 min-h-0 overflow-y-auto p-3 mb-5">
        {doc?.blocks ? (
          <BlockRenderer blocks={doc.blocks} settings={doc.settings} />
        ) : (
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <Skeleton key={n} className="my-2 w-full"></Skeleton>
          ))
        )}
      </main>

      <div className="mt-5 text-sm text-[rgb(var(--muted))] text-center">
        Generated with Readable.
      </div>

      <div className="mt-5 pb-6 flex items-center justify-center gap-4 text-[12px] text-[rgb(var(--muted))]">
        © {new Date().getFullYear()} {APP_NAME}. Built for clarity.
      </div>
    </div>
  );
}

function formatRelative(dt: Date): string {
  const now = Date.now();
  const diff = dt.getTime() - now;

  if (diff <= 0) return "already expired";

  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins} minute${mins === 1 ? "" : "s"}`;

  const hours = Math.floor(mins / 60);
  if (hours < 48) return `in ${hours} hour${hours === 1 ? "" : "s"}`;

  const days = Math.floor(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

function extractTitle(blocks: any[]): string | null {
  for (const b of blocks ?? []) {
    if (b?.t === "heading" && (b?.level === 1 || b?.level === 2)) {
      const t = inlineToText(b?.inl);
      if (t) return clamp(t, 64);
    }
  }
  return null;
}

function extractDescription(blocks: any[]): string {
  for (const b of blocks ?? []) {
    if (b?.t === "paragraph") {
      const t = inlineToText(b?.inl);
      if (t) return clamp(t, 160);
    }
  }
  return "A clean, readable share page.";
}

function inlineToText(inl: any): string {
  if (!inl) return "";
  if (Array.isArray(inl)) return inl.map(inlineToText).join("").trim();
  if (typeof inl === "string") return inl;
  if (inl.t === "text" || inl.t === "code") return String(inl.v ?? "");
  if (inl.t === "link") return inlineToText(inl.c);
  if (inl.t === "strong" || inl.t === "em") return inlineToText(inl.c);
  return "";
}

function clamp(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
}

function NotFoundOrExpired() {
  return (
    <main className="w-screen h-screen flex items-center justify-center bg-bg text-text-primary">
      <div className="p-8 text-center flex flex-col gap-2">
        <div className="text-lg font-semibold uppercase tracking-wide">
          Not found
        </div>
        <div className="text-sm text-[rgb(var(--muted))] uppercase tracking-widest">
          This page doesn’t exist or it has expired.
        </div>
        <Link href={ROUTES.app}>
          <Button
            label="Create a Readable page"
            rounded
            className="min-w-fit uppercase tracking-wide"
            size="small"
          />
        </Link>

        <div className="leading-tight uppercase mt-10">
          <Link href={ROUTES.home}>
            <div className="font-semibold tracking-wide">{APP_NAME}</div>
          </Link>
          <div className="hidden sm:inline-flex text-xs text-[rgb(var(--muted))] tracking-widest">
            Paste. Preview. Share.
          </div>
        </div>
      </div>
    </main>
  );
}

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}
