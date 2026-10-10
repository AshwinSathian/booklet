import { z } from "zod";
import { DocTypeSchema, MAX_RAW_CHARS, VisibilitySchema } from "booklet-api-client";

// Mirrors src/lib/slug.ts's canonical rule in the main app (3-60 chars,
// no leading/trailing/consecutive hyphens) — this package is a standalone
// npm workspace with no shared build step with the main app, so the rule
// is duplicated here rather than imported. Keep in sync if that file
// changes: the two previously drifted (this used to allow 1-2 char slugs,
// which the REST API's v1/publish and v1/pages routes now reject with a
// 422 after the slug-validation unification), causing a wasted round trip
// for anything shorter than 3 characters.
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{3,60}$/;

function isValidSlug(s: string): boolean {
  return SLUG_PATTERN.test(s) && !s.includes("--");
}

// Each .describe() below is the ONLY place these constraints are visible to
// the model (they end up in the tool's JSON Schema, sent on every
// tools/list) — so they're trimmed to exactly what prevents a failed call
// (char limits, the slug rule, what `confirm` does), not a feature tour of
// Markdown. MCP tool schemas already cost materially more tokens than a
// minimal equivalent, and tools/list is loaded into every session.
const slugSchema = z
  .string()
  .refine(isValidSlug, "`slug` must be 3-60 lowercase letters, numbers, or hyphens (no leading/trailing/consecutive hyphens)")
  .describe(
    'Custom URL slug, e.g. "my-release-notes". 3-60 lowercase letters/numbers/hyphens, no leading, trailing, or consecutive hyphens. Results in a URL like /p/my-release-notes.',
  );

const MAX_RAW_LABEL = MAX_RAW_CHARS.toLocaleString("en-US");
const RAW_TOO_LONG = `\`raw\` exceeds ${MAX_RAW_LABEL} character limit`;

export const PublishPageInputSchema = z.object({
  raw: z
    .string()
    .min(1, "`raw` must be a non-empty string")
    .max(MAX_RAW_CHARS, RAW_TOO_LONG)
    .describe(`Markdown content to publish (GFM + Mermaid diagrams). Max ${MAX_RAW_LABEL} characters.`),
  title: z.string().optional().describe("Overrides the page title. Defaults to the first H1 in `raw`."),
  slug: slugSchema.optional(),
  visibility: z
    .enum(["public", "unlisted"])
    .optional()
    .describe(
      '"unlisted" (default: reachable by URL, hidden from listings and search engines) or "public" (listed on Explore and indexable).',
    ),
});

const spaceSchema = z.string().min(1).max(60).describe("Slug of a team space you belong to, as in /t/<slug>.");

export const CreateDocumentInputSchema = z.object({
  type: DocTypeSchema.describe("Document type. Sets the page's header strip and its group in a team space."),
  title: z.string().min(1).max(200).describe('Page title, e.g. "ADR-012 Queue retries". Other pages link to it as [[title]].'),
  body: z
    .string()
    .min(1, "`body` must be a non-empty string")
    .max(MAX_RAW_CHARS - 2_000, "`body` is too long")
    .describe("Markdown body, without frontmatter and without the title heading. [[Title]] links to a page of that title in the same space."),
  status: z.string().max(40).optional().describe('e.g. "Proposed", "Accepted", "Resolved".'),
  severity: z.string().max(20).optional().describe('e.g. "P1". For incidents and postmortems.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "`date` must be YYYY-MM-DD").optional().describe("YYYY-MM-DD. Defaults to today."),
  owners: z.array(z.string().max(60)).max(20).optional().describe("People or teams responsible."),
  supersedes: z.string().max(200).optional().describe("Title of the document this one replaces."),
  space: spaceSchema.optional(),
  visibility: VisibilitySchema.optional().describe(
    '"unlisted" (default), "public", or "team" (only members of `space` can open it; needs `space`).',
  ),
});

export const SearchPagesInputSchema = z.object({
  query: z.string().optional().describe("Text the title must contain (case-insensitive)."),
  type: DocTypeSchema.optional().describe("Only this document type."),
  space: spaceSchema
    .optional()
    .describe("Search this team space (every member's pages) instead of your own pages. Slug as in /t/<slug>."),
  limit: z.number().int().positive().max(100).optional().describe("Max results. Default 20, max 100."),
});

export const UpdatePageInputSchema = z
  .object({
    id: z.string().min(1, "`id` must be a non-empty string").describe("The page ID or custom slug to update."),
    raw: z
      .string()
      .min(1, "`raw` must be a non-empty string if provided")
      .max(MAX_RAW_CHARS, RAW_TOO_LONG)
      .optional()
      .describe("New Markdown content. Replaces the existing content entirely."),
    slug: slugSchema
      .nullable()
      .optional()
      .describe("New custom slug, or null to remove it and revert to the page ID."),
    visibility: VisibilitySchema.optional().describe(
      'Change visibility to "public", "unlisted" or "team" (team space members only; the page must be in a team space).',
    ),
  })
  .refine(
    (v) => v.raw !== undefined || v.slug !== undefined || v.visibility !== undefined,
    "Provide at least one of: `raw`, `slug`, `visibility`",
  );

export const GetPageInputSchema = z.object({
  id: z.string().min(1, "`id` must be a non-empty string").describe("The page ID or custom slug to retrieve."),
});

export const ListPagesInputSchema = z.object({
  limit: z.number().int().positive().max(100).optional().describe("Max pages to return. Default 20, max 100."),
  cursor: z.string().optional().describe("The cursor a previous list_pages result gave for the next page."),
  query: z
    .string()
    .optional()
    .describe(
      'Filter to pages whose title contains this text (case-insensitive). Use this before publish_page to check whether a page on this topic already exists, or to find the right page id to pass to update_page instead of listing everything.',
    ),
  tag: z
    .string()
    .optional()
    .describe("Filter to pages with this exact frontmatter tag (e.g. \"runbook\")."),
});

export const DeletePageInputSchema = z.object({
  id: z.string().min(1, "`id` must be a non-empty string").describe("The page ID to delete."),
  confirm: z
    .boolean()
    .refine((v) => v === true, "`confirm` must be true to delete a page. This action cannot be undone.")
    .describe("Must be true to proceed. Prevents accidental deletion — this cannot be undone."),
});

export const PublishPageOutputSchema = z.object({
  id: z.string(),
  url: z.string(),
});

export const UpdatePageOutputSchema = z.object({
  id: z.string(),
  url: z.string(),
  updated_at: z.string().optional(),
});

export const GetPageOutputSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  slug: z.string().nullable(),
  visibility: VisibilitySchema,
  view_count: z.number(),
  url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  content_omitted: z.boolean(),
  content_length: z.number().optional(),
});

export const CreateDocumentOutputSchema = z.object({
  id: z.string(),
  url: z.string(),
  type: DocTypeSchema,
});

export const SearchPagesOutputSchema = z.object({
  pages: z.array(
    z.object({
      id: z.string(),
      title: z.string().nullable(),
      url: z.string(),
      type: DocTypeSchema.nullable(),
      visibility: VisibilitySchema,
      space: z.string().nullable(),
    }),
  ),
  total: z.number(),
});

export const DeletePageOutputSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
});
