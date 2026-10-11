import type { DbPage } from "@/lib/db/types";
import { DOC_TYPE_GROUPS } from "@/lib/doc-types";

export type SpaceGroup = { key: string; heading: string; pages: DbPage[] };

/** The number in an ADR's title ("ADR-012 Queue retries" → 12), or null. */
export function adrNumber(title: string | null): number | null {
  const m = /\d+/.exec(title ?? "");
  return m ? Number(m[0]) : null;
}

/** Frontmatter `date` if it parses, else when the page was published. */
function docTime(page: DbPage): number {
  const raw = page.frontmatter_meta?.date;
  const t = typeof raw === "string" ? Date.parse(raw) : NaN;
  return Number.isNaN(t) ? Date.parse(page.created_at) : t;
}

const newestFirst = (a: DbPage, b: DbPage) => docTime(b) - docTime(a);

/**
 * A team space's pages grouped by document type, in a fixed order, with
 * untyped pages last. The decision log reads in ADR-number order, as a log
 * does; everything else is newest first, by the date the document gives
 * itself (an incident's date, not the day its report was published).
 * Empty groups are left out.
 */
export function groupSpacePages(pages: DbPage[]): SpaceGroup[] {
  const groups: SpaceGroup[] = DOC_TYPE_GROUPS.map(({ type, heading }) => ({
    key: type,
    heading,
    pages: pages
      .filter((p) => p.doc_type === type)
      .sort(
        type === "adr"
          ? (a, b) => (adrNumber(a.title) ?? Infinity) - (adrNumber(b.title) ?? Infinity) || newestFirst(a, b)
          : newestFirst,
      ),
  }));
  groups.push({ key: "other", heading: "Other pages", pages: pages.filter((p) => !p.doc_type).sort(newestFirst) });
  const filled = groups.filter((g) => g.pages.length > 0);
  // "Other" needs something to be other than.
  return filled.length === 1 && filled[0].key === "other" ? [{ ...filled[0], heading: "Pages" }] : filled;
}

const xml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string)
    // Characters XML 1.0 does not allow at all.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/**
 * Atom 1.0 feed (RFC 4287) of a space's public pages, newest first. The
 * caller passes public pages only and serves no feed when there are none.
 */
export function buildSpaceFeed(space: { name: string; slug: string }, pages: DbPage[], origin: string): string {
  const self = `${origin}/t/${space.slug}/feed.xml`;
  const sorted = [...pages].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const entries = sorted.map((p) => {
    const url = `${origin}/p/${p.slug ?? p.id}`;
    return [
      "  <entry>",
      `    <id>${xml(`${origin}/p/${p.id}`)}</id>`,
      `    <title>${xml(p.title ?? "Untitled")}</title>`,
      // Readers show an entry with no text as empty; the description, or
      // failing that the title again, gives them something.
      `    <summary>${xml(typeof p.frontmatter_meta?.description === "string" ? p.frontmatter_meta.description : (p.title ?? "Untitled"))}</summary>`,
      `    <link rel="alternate" type="text/html" href="${xml(url)}"/>`,
      `    <published>${xml(p.created_at)}</published>`,
      `    <updated>${xml(p.updated_at)}</updated>`,
      ...(p.doc_type ? [`    <category term="${xml(p.doc_type)}"/>`] : []),
      "  </entry>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${xml(self)}</id>`,
    `  <title>${xml(space.name)}</title>`,
    `  <updated>${xml(sorted[0]?.updated_at ?? new Date(0).toISOString())}</updated>`,
    `  <author><name>${xml(space.name)}</name></author>`,
    `  <link rel="self" type="application/atom+xml" href="${xml(self)}"/>`,
    `  <link rel="alternate" type="text/html" href="${xml(`${origin}/t/${space.slug}`)}"/>`,
    ...entries,
    "</feed>",
    "",
  ].join("\n");
}
