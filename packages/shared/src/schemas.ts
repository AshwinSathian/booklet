/**
 * Zod schemas for the Readable /api/v1 REST surface — the single source of
 * truth for both the server (src/server/*, which imports these back into
 * the main app) and every client (mcp-server, packages/cli,
 * packages/github-action, packages/vscode). See PLAN-backend-auth-migration.md
 * Phase 3 for the full endpoint list this expands to cover.
 */

import { z } from "zod";

export const PageListItemSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  slug: z.string().nullable(),
  visibility: z.enum(["public", "unlisted"]),
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

export const ApiErrorSchema = z.object({
  error: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
