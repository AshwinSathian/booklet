/**
 * Zod schemas for the Booklet /api/v1 REST surface — the single source of
 * truth for every client (mcp-server, packages/cli, packages/github-action,
 * packages/vscode). Covers exactly the 5 endpoints those four consumers
 * actually call: POST /publish, PATCH /pages/:id, GET /pages/:id,
 * DELETE /pages/:id, GET /pages.
 */

import { z } from "zod";

export const VisibilitySchema = z.enum(["public", "unlisted"]);

export const PageListItemSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  slug: z.string().nullable(),
  visibility: VisibilitySchema,
  view_count: z.number(),
  url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PageListItem = z.infer<typeof PageListItemSchema>;

export const ListPagesResponseSchema = z.object({
  pages: z.array(PageListItemSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});
export type ListPagesResponse = z.infer<typeof ListPagesResponseSchema>;

export const PublishRequestSchema = z.object({
  raw: z.string().min(1),
});
export type PublishRequest = z.infer<typeof PublishRequestSchema>;

export const PublishResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
});
export type PublishResponse = z.infer<typeof PublishResponseSchema>;

export const PatchPageRequestSchema = z.object({
  raw: z.string().optional(),
  slug: z.string().nullable().optional(),
  visibility: VisibilitySchema.optional(),
});
export type PatchPageRequest = z.infer<typeof PatchPageRequestSchema>;

export const PatchPageResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  updated_at: z.string().optional(),
});
export type PatchPageResponse = z.infer<typeof PatchPageResponseSchema>;

export const PageDetailResponseSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  slug: z.string().nullable(),
  visibility: VisibilitySchema,
  view_count: z.number(),
  url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  raw: z.string().nullable(),
});
export type PageDetailResponse = z.infer<typeof PageDetailResponseSchema>;

export const DeletePageResponseSchema = z.object({
  ok: z.literal(true),
});
export type DeletePageResponse = z.infer<typeof DeletePageResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
