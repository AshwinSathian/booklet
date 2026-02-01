import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { getDoc } from "@/lib/storage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "primereact/button";
import { Skeleton } from "primereact/skeleton";

export const runtime = "nodejs";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDoc(id);

  if (!doc) {
    return <NotFoundOrExpired />;
  }

  if (!doc) return notFound();

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

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block text-xs text-[rgb(var(--muted))] uppercase tracking-widest">
              Published {new Date(doc.createdAt).toLocaleString()}
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
