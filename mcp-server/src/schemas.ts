import { z } from "zod";
import { VisibilitySchema } from "booklet-api-client";

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

export const PublishPageInputSchema = z.object({
  raw: z
    .string()
    .min(1, "`raw` must be a non-empty string")
    .max(350_000, "`raw` exceeds 350,000 character limit")
    .describe("Markdown content to publish (GFM + Mermaid diagrams). Max 350,000 characters."),
  title: z.string().optional().describe("Overrides the page title. Defaults to the first H1 in `raw`."),
  slug: slugSchema.optional(),
  visibility: VisibilitySchema.optional().describe(
    '"public" (default, listed) or "unlisted" (hidden from listings, still reachable by URL).',
  ),
});

export const UpdatePageInputSchema = z
  .object({
    id: z.string().min(1, "`id` must be a non-empty string").describe("The page ID or custom slug to update."),
    raw: z
      .string()
      .min(1, "`raw` must be a non-empty string if provided")
      .max(350_000, "`raw` exceeds 350,000 character limit")
      .optional()
      .describe("New Markdown content. Replaces the existing content entirely."),
    slug: slugSchema
      .nullable()
      .optional()
      .describe("New custom slug, or null to remove it and revert to the page ID."),
    visibility: VisibilitySchema.optional().describe('Change visibility to "public" or "unlisted".'),
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
  offset: z.number().int().nonnegative().optional().describe("Pages to skip, for pagination. Default 0."),
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

export const DeletePageOutputSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
});
