import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { getDoc } from "@/lib/storage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Skeleton } from "primereact/skeleton";

export const runtime = "nodejs";

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getDoc(id);

  if (!doc) return notFound();

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-20 border-b border-outline bg-bg-glass/85 backdrop-blur">
        <div className="max-w-275 mx-auto px-4 py-3 flex items-center justify-between">
          <div className="leading-tight uppercase">
            <Link href={ROUTES.home}>
              <div className="font-semibold tracking-wide">{APP_NAME}</div>
            </Link>
            <div className="text-xs text-[rgb(var(--muted))] tracking-widest">
              Paste. Preview. Share.
            </div>
          </div>

          <div className="text-xs text-[rgb(var(--muted))] uppercase tracking-widest">
            Published {new Date(doc.createdAt).toLocaleString()}
          </div>
        </div>
      </div>

      <main className="max-w-275 mx-auto flex-1 min-h-0 overflow-y-auto p-3 mb-5">
        {doc?.blocks ? (
          <BlockRenderer blocks={doc.blocks} settings={doc.settings} />
        ) : (
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((_) => (
            <Skeleton className="my-2 w-full"></Skeleton>
          ))
        )}
      </main>

      <div className="mt-8 flex items-center justify-center gap-4 text-[12px] text-[rgb(var(--rl-muted))]">
        © {new Date().getFullYear()} {APP_NAME}. Built for clarity.
      </div>
    </div>
  );
}

export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}
