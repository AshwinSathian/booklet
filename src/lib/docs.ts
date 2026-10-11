import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { schemaExamples, type OpenApiSchemaName } from "booklet-api-client";
import yaml from "js-yaml";
import { walkBlocks } from "@/lib/block-tree";
import { DOC_EMBEDS, DOC_SECTIONS, type DocSectionId } from "@/lib/docs-nav";
import { stripFrontmatter } from "@/lib/frontmatter";
import { inlineToPlainText } from "@/lib/inline-text";
import { parseToBlocks } from "@/lib/parse";
import { buildToc } from "@/lib/toc";

/**
 * The documentation at /docs: Markdown files under content/docs, rendered by
 * the same parser and renderer as a published page.
 *
 * A file's frontmatter is `title`, `description`, `order` (position within
 * its section) and optionally `nav` (a shorter sidebar label). The body has
 * no level-1 heading: the page draws the title.
 */
export type DocPage = {
  slug: string[];
  href: string;
  section: DocSectionId;
  title: string;
  nav: string;
  description: string;
  order: number;
  /** The file as written, frontmatter included. Served at <href>.md. */
  raw: string;
  /** The Markdown after the frontmatter. */
  body: string;
};
export type DocSection = { id: DocSectionId; title: string; blurb: string; pages: DocPage[] };
export type SearchEntry = { href: string; title: string; section: string; heading: string | null; text: string };

const ROOT = path.join(process.cwd(), "content", "docs");

/**
 * `{{example:PublishRequest}}` (or `{{example:PatchPageRequest:2}}` for the
 * third example) in a docs file is replaced by that example from the API's
 * own schema, so a request or response shown in the docs cannot disagree
 * with /api/v1/openapi.json. A name with no such example throws: the page
 * would otherwise show the token.
 */
function fillExamples(text: string, file: string): string {
  return text.replace(/\{\{example:([A-Za-z]+)(?::(\d+))?\}\}/g, (_, name: string, index?: string) => {
    const example = schemaExamples(name as OpenApiSchemaName)[Number(index ?? 0)];
    if (example === undefined) throw new Error(`${file}: no example ${index ?? 0} for schema ${name}`);
    return JSON.stringify(example, null, 2);
  });
}
const SEGMENT = /^[a-z0-9-]+$/;

function readPage(file: string): DocPage {
  const raw = fillExamples(readFileSync(file, "utf8"), file);
  const slug = path.relative(ROOT, file).replace(/\.md$/, "").split(path.sep);
  const front = /^---\n([\s\S]*?)\n---\n/.exec(raw);
  // The app's own parseFrontmatter keeps a fixed set of page keys and drops
  // the rest, `order` and `nav` among them, so the YAML is read directly.
  const meta = (front ? yaml.load(front[1]) : {}) as { title?: unknown; description?: unknown; order?: unknown; nav?: unknown };
  const title = typeof meta.title === "string" ? meta.title : "";
  return {
    slug,
    href: `/docs/${slug.join("/")}`,
    section: (slug.length > 1 ? slug[0] : "start") as DocSectionId,
    title,
    nav: typeof meta.nav === "string" ? meta.nav : title,
    description: typeof meta.description === "string" ? meta.description : "",
    order: typeof meta.order === "number" ? meta.order : 999,
    raw,
    body: stripFrontmatter(raw).trim(),
  };
}

function readTree(): DocSection[] {
  const files = (readdirSync(ROOT, { recursive: true }) as string[]).filter((f) => f.endsWith(".md")).map((f) => path.join(ROOT, f));
  const pages = files.map(readPage);
  return DOC_SECTIONS.map((section) => ({
    ...section,
    pages: pages.filter((p) => p.section === section.id).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
  }));
}

let cached: DocSection[] | null = null;
/** Every section with its pages, in sidebar order. Read once per process; re-read on every call in development. */
export function getDocsTree(): DocSection[] {
  if (process.env.NODE_ENV === "development") return readTree();
  return (cached ??= readTree());
}

const allPages = () => getDocsTree().flatMap((s) => s.pages);

/** The page at a slug, or null. A segment that is not lowercase letters, digits and hyphens never matches. */
export function getDocPage(slug: string[]): DocPage | null {
  if (!slug.length || !slug.every((s) => SEGMENT.test(s))) return null;
  const href = `/docs/${slug.join("/")}`;
  return allPages().find((p) => p.href === href) ?? null;
}

export function getNeighbours(page: DocPage): { prev: DocPage | null; next: DocPage | null } {
  const pages = allPages();
  const i = pages.findIndex((p) => p.href === page.href);
  return { prev: pages[i - 1] ?? null, next: pages[i + 1] ?? null };
}

/** One entry per page and one per h2/h3, each with the text that follows it. */
export function getSearchIndex(): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const section of getDocsTree()) {
    for (const page of section.pages) {
      out.push({ href: page.href, title: page.title, section: section.title, heading: null, text: page.description });
      const blocks = parseToBlocks(page.body);
      const { anchorMap } = buildToc(blocks);
      blocks.forEach((b, i) => {
        if (b.t !== "heading" || !anchorMap[String(i)]) return;
        const after = blocks[i + 1];
        out.push({
          href: `${page.href}#${anchorMap[String(i)]}`,
          title: page.title,
          section: section.title,
          heading: inlineToPlainText(b.inl),
          text: after?.t === "paragraph" ? inlineToPlainText(after.inl).slice(0, 200) : "",
        });
      });
    }
  }
  return out;
}

/** Every link target in the page's Markdown that starts with "/". */
export function getInternalLinks(page: DocPage): string[] {
  return [...page.body.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);
}

/**
 * What the content checks look at: level-1 headings, wikilinks (which a
 * reader would get as a dead button) and embed names that no component
 * answers to. Empty when the page is fine.
 */
export function lintDocPage(page: DocPage): string[] {
  const problems: string[] = [];
  const blocks = parseToBlocks(page.body);
  walkBlocks(blocks, (b) => {
    if (b.t === "heading" && b.level === 1) problems.push("has a level-1 heading; the page title is the h1");
    if (b.t === "code" && b.lang === "booklet-embed" && !(DOC_EMBEDS as readonly string[]).includes(b.code.trim())) {
      problems.push(`embeds "${b.code.trim()}", which is not a known component`);
    }
  });
  if (JSON.stringify(blocks).includes('"t":"wikilink"')) problems.push("contains a [[wikilink]] outside code");
  return problems;
}
