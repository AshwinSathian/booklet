import { z } from "zod";
import { CALLOUT_KINDS, COLUMNS_MAX, COLUMNS_MIN } from "./blocks";

/**
 * Mirrors the `Block`/`Inline`/`ListItem` types in ./blocks exactly, for
 * server-side validation of publish/patch payloads. Until this existed, the
 * three write endpoints (api/publish, api/v1/publish, api/v1/pages/[id]
 * PATCH) accepted any array as `blocks` with no shape check beyond byte
 * size — a malformed or unexpected shape could be persisted and later crash
 * the renderer for viewers. This schema is additive: it validates against
 * the *current* canonical shape, not the legacy bare-Inline[]-array list
 * item shape some pre-existing published docs contain (BlockRenderer's
 * backward-compat guard is for reading old data, not for accepting new
 * writes in that shape — a client submitting the legacy shape directly is
 * now rejected, which is intentional).
 */

const InlineSchema: z.ZodType<import("./blocks").Inline> = z.lazy(() =>
  z.discriminatedUnion("t", [
    z.object({ t: z.literal("text"), v: z.string() }),
    z.object({ t: z.literal("strong"), c: z.array(InlineSchema) }),
    z.object({ t: z.literal("em"), c: z.array(InlineSchema) }),
    z.object({ t: z.literal("del"), c: z.array(InlineSchema) }),
    z.object({ t: z.literal("code"), v: z.string() }),
    z.object({ t: z.literal("link"), href: z.string(), c: z.array(InlineSchema) }),
    z.object({ t: z.literal("image"), src: z.string(), alt: z.string() }),
    z.object({ t: z.literal("math"), v: z.string() }),
  ]),
);

const ListItemSchema: z.ZodType<import("./blocks").ListItem> = z.lazy(() =>
  z.object({
    inl: z.array(InlineSchema),
    checked: z.boolean().nullable().optional(),
    children: z.array(BlockSchema).optional(),
  }),
);

export const BlockSchema: z.ZodType<import("./blocks").Block> = z.lazy(() =>
  z.discriminatedUnion("t", [
    z.object({
      t: z.literal("heading"),
      level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      inl: z.array(InlineSchema),
    }),
    z.object({ t: z.literal("paragraph"), inl: z.array(InlineSchema) }),
    z.object({ t: z.literal("list"), ordered: z.boolean(), items: z.array(ListItemSchema) }),
    z.object({ t: z.literal("quote"), blocks: z.array(BlockSchema) }),
    z.object({
      t: z.literal("callout"),
      kind: z.enum(CALLOUT_KINDS),
      blocks: z.array(BlockSchema),
    }),
    z.object({
      t: z.literal("toggle"),
      summary: z.string(),
      blocks: z.array(BlockSchema),
    }),
    z.object({
      t: z.literal("columns"),
      columns: z.array(z.array(BlockSchema)).min(COLUMNS_MIN).max(COLUMNS_MAX),
    }),
    z.object({ t: z.literal("code"), lang: z.string().optional(), code: z.string() }),
    z.object({
      t: z.literal("table"),
      head: z.array(z.array(InlineSchema)),
      rows: z.array(z.array(z.array(InlineSchema))),
    }),
    z.object({ t: z.literal("hr") }),
    z.object({ t: z.literal("image"), src: z.string(), alt: z.string() }),
    z.object({ t: z.literal("diagram"), lang: z.string(), code: z.string() }),
    z.object({ t: z.literal("math"), display: z.literal(true), code: z.string() }),
  ]),
);

export const BlocksArraySchema = z.array(BlockSchema);

/**
 * Validates a publish/patch payload's `blocks` array. Returns null when
 * valid, or a short human-readable error string when not — callers turn
 * that into a 400 response rather than persisting the payload.
 */
export function validateBlocks(blocks: unknown): string | null {
  const result = BlocksArraySchema.safeParse(blocks);
  if (result.success) return null;
  const first = result.error.issues[0];
  const path = first?.path?.length ? ` at blocks[${first.path.join(".")}]` : "";
  return `Invalid block content${path}: ${first?.message ?? "unknown validation error"}`;
}
