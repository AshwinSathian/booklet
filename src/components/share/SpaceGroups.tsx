import { StatusChip, formatDocDate } from "@/components/share/DocHeaderStrip";
import { ROUTES } from "@/lib/constants";
import type { SpaceGroup } from "@/lib/space-groups";
import Link from "next/link";

/**
 * A team space's pages, grouped by document type: heading with a count, then
 * one row a page with its status, who can read it and its date. Used by the
 * space's home and by the homepage, which shows this same list with sample
 * pages.
 */
export function SpaceGroups({ groups }: { groups: SpaceGroup[] }) {
  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`group-${group.key}`} data-group={group.key}>
          <h2 id={`group-${group.key}`} className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">
            {group.heading} <span className="font-normal tabular-nums">({group.pages.length})</span>
          </h2>
          <ul className="mt-3 divide-y divide-border-default border-y border-border-default">
            {group.pages.map((page) => {
              const status = page.frontmatter_meta?.status;
              const date = page.frontmatter_meta?.date;
              return (
                <li key={page.id}>
                  <Link
                    href={ROUTES.publish(page.slug ?? page.id)}
                    className="group flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3.5"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-text-primary group-hover:underline underline-offset-3">
                      {page.title ?? "Untitled"}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-text-muted">
                      {typeof status === "string" && status ? <StatusChip status={status} /> : null}
                      {page.visibility !== "public" ? <span>{page.visibility === "team" ? "Team only" : "Unlisted"}</span> : null}
                      <time>{formatDocDate(typeof date === "string" && date ? date : page.created_at)}</time>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
