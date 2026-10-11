/**
 * Zod schemas for the Booklet /api/v1 REST surface — the single source of
 * truth for every client (mcp-server, packages/cli, the GitHub Action).
 * Covers exactly the 5 endpoints those consumers
 * actually call: POST /publish, PATCH /pages/:id, GET /pages/:id,
 * DELETE /pages/:id, GET /pages.
 */

import { z } from "zod";

/** Largest Markdown document any publish path accepts, in characters. */
export const MAX_RAW_CHARS = 200_000;

/**
 * `team` restricts a page to the members of the team space it is in. It is
 * only valid for a page in a team space.
 */
export const VisibilitySchema = z.enum(["public", "unlisted", "team"]);
export type Visibility = z.infer<typeof VisibilitySchema>;

/** Engineering document types. Set with frontmatter `type`. */
export const DOC_TYPES = ["incident", "postmortem", "adr", "rfc", "runbook", "release-notes"] as const;
export const DocTypeSchema = z.enum(DOC_TYPES);
export type DocType = z.infer<typeof DocTypeSchema>;

const EXAMPLE_PAGE = {
  id: "Ab3k91QxZp",
  title: "Release Notes v2.1",
  slug: "release-notes-v2-1",
  visibility: "unlisted" as const,
  doc_type: "release-notes" as const,
  space: null,
  view_count: 42,
  url: "https://booklet.ashwinsathian.com/p/release-notes-v2-1",
  created_at: "2026-04-29T10:00:00.000Z",
  updated_at: "2026-04-29T12:00:00.000Z",
};

const pageFields = {
  id: z.string(),
  title: z.string().nullable(),
  slug: z.string().nullable(),
  visibility: VisibilitySchema,
  /** From frontmatter `type`; null for an untyped page. */
  doc_type: DocTypeSchema.nullable(),
  /** Slug of the team space the page is in, or null. */
  space: z.string().nullable(),
  view_count: z.number(),
  url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
};

export const PageListItemSchema = z.object(pageFields).meta({ examples: [EXAMPLE_PAGE] });
export type PageListItem = z.infer<typeof PageListItemSchema>;

export const ListPagesResponseSchema = z
  .object({
    pages: z.array(PageListItemSchema),
    total: z.number(),
    limit: z.number(),
    /** Pass as `cursor` to get the next page; null on the last page. */
    next_cursor: z.string().nullable(),
  })
  .meta({
    examples: [{ pages: [EXAMPLE_PAGE], total: 57, limit: 20, next_cursor: "WyIyMDI2LTA0LTI5VDEwOjAwOjAwLjAwMFoiLCJBYjNrOTFReFpwIl0" }],
  });
export type ListPagesResponse = z.infer<typeof ListPagesResponseSchema>;

export const PublishRequestSchema = z
  .object({
    raw: z.string().min(1).max(MAX_RAW_CHARS),
    settings: z.object({ width: z.enum(["normal", "wide"]) }).partial().optional(),
    /** Overrides frontmatter `visibility`. A new page is unlisted unless this or frontmatter says public. */
    visibility: VisibilitySchema.optional(),
    /** Slug of a team space you can write to. The page is created in it. Required for `visibility: "team"`. */
    space: z.string().optional(),
  })
  .meta({ examples: [{ raw: "# Release Notes\n\nWhat changed...", visibility: "unlisted" }] });
export type PublishRequest = z.infer<typeof PublishRequestSchema>;

export const PublishResponseSchema = z
  .object({
    id: z.string(),
    url: z.string(),
    /** Present when a requested slug could not be applied. */
    warning: z.string().optional(),
  })
  .meta({ examples: [{ id: "Ab3k91QxZp", url: "https://booklet.ashwinsathian.com/p/Ab3k91QxZp" }] });
export type PublishResponse = z.infer<typeof PublishResponseSchema>;

export const PatchPageRequestSchema = z
  .object({
    raw: z.string().max(MAX_RAW_CHARS).optional(),
    slug: z.string().nullable().optional(),
    visibility: VisibilitySchema.optional(),
    /**
     * Moves the page: the slug of a team space you can publish to, or null
     * to take it out of its space. A team-only page stays where it is
     * unless `visibility` changes in the same request.
     */
    space: z.string().nullable().optional(),
  })
  .meta({
    examples: [
      { raw: "# Updated content\n\n..." },
      { slug: "my-custom-slug" },
      { slug: null },
      { visibility: "public" },
      { space: "platform-team", visibility: "team" },
      { space: null },
    ],
  });
export type PatchPageRequest = z.infer<typeof PatchPageRequestSchema>;

export const PatchPageResponseSchema = z
  .object({
    id: z.string(),
    url: z.string(),
    updated_at: z.string().optional(),
  })
  .meta({
    examples: [{ id: "Ab3k91QxZp", url: "https://booklet.ashwinsathian.com/p/Ab3k91QxZp", updated_at: "2026-04-29T12:00:00.000Z" }],
  });
export type PatchPageResponse = z.infer<typeof PatchPageResponseSchema>;

export const PageDetailResponseSchema = z
  .object({ ...pageFields, raw: z.string().nullable() })
  .meta({ examples: [{ ...EXAMPLE_PAGE, raw: "# Release Notes v2.1\n\nWhat changed..." }] });
export type PageDetailResponse = z.infer<typeof PageDetailResponseSchema>;

export const DeletePageResponseSchema = z.object({ ok: z.literal(true) }).meta({ examples: [{ ok: true }] });
export type DeletePageResponse = z.infer<typeof DeletePageResponseSchema>;

/**
 * Error body: RFC 9457 problem details (`application/problem+json`).
 * Extension members (`code`, `limit`, `max`, `actual`) pass through.
 */
export const ApiErrorSchema = z
  .looseObject({
    type: z.string(),
    title: z.string(),
    status: z.number(),
    detail: z.string(),
    code: z.string().optional(),
  })
  .meta({
    examples: [
      {
        type: "about:blank",
        title: "Content Too Large",
        status: 413,
        detail: "Document is too large. The limit is 200,000 characters; this one has 200,001.",
        code: "DOCUMENT_TOO_LARGE",
        limit: "characters",
        max: 200000,
        actual: 200001,
      },
    ],
  });
export type ApiError = z.infer<typeof ApiErrorSchema>;
