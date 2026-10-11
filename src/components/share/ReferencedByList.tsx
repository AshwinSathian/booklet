import { ROUTES } from "@/lib/constants";
import Link from "next/link";

/** The "Referenced by" panel under a published page: the pages that link to it. Also shown, with sample pages, on the homepage. */
export function ReferencedByList({ pages }: { pages: Array<{ id: string; slug: string | null; title: string | null }> }) {
  return (
    <nav aria-labelledby="referenced-by" className="mt-10 border-t border-border-subtle pt-6 print:hidden">
      <h2 id="referenced-by" className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        Referenced by
      </h2>
      <ul className="mt-3 space-y-1.5">
        {pages.map((page) => (
          <li key={page.id}>
            <Link href={ROUTES.publish(page.slug ?? page.id)} className="text-sm text-accent-soft underline decoration-1 underline-offset-3">
              {page.title ?? "Untitled"}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
