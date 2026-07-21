import { z } from "zod";
import { CALLOUT_KINDS, COLUMNS_MAX, COLUMNS_MIN } from "./blocks";

/**
 * Mirrors the `Block`/`Inline`/`ListItem` types in ./blocks exactly.
 *
 * This is no longer a client-facing trust boundary: every publish/patch
 * route now derives `blocks` exclusively from `parseToBlocks(raw)` — a
 * client can no longer submit a pre-built block tree directly (see
 * PLAN-rich-markdown-blocks.md's "Option B" for why that used to be
 * possible, and the depth/count guards in src/lib/parse.ts /
 * src/lib/blocks.ts's MAX_BLOCK_DEPTH for why unvalidated client-supplied
 * trees were a stack-overflow DoS vector once discovered). validateBlocks is
 * now called on our *own* parser's output right before storage, purely as
 * an invariant assertion — if it ever fails, that means parseToBlocks
 * produced a shape its own type doesn't describe, i.e. a parser bug, and
 * the safe response is to fail the publish rather than persist a tree the
 * rest of the pipeline (React renderer, HTML exporter, TOC builder) isn't
 * guaranteed to handle.
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
    z.object({ t: z.literal("footnoteRef"), id: z.string(), n: z.number() }),
  ]),
);

const TableAlignSchema = z.union([z.literal("left"), z.literal("center"), z.literal("right"), z.null()]);

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
      align: z.array(TableAlignSchema),
    }),
    z.object({ t: z.literal("hr") }),
    z.object({ t: z.literal("image"), src: z.string(), alt: z.string() }),
    z.object({ t: z.literal("diagram"), lang: z.string(), code: z.string() }),
    z.object({ t: z.literal("math"), display: z.literal(true), code: z.string() }),
    z.object({
      t: z.literal("footnotes"),
      items: z.array(
        z.object({ id: z.string(), n: z.number(), blocks: z.array(BlockSchema) }),
      ),
    }),
  ]),
);

export const BlocksArraySchema = z.array(BlockSchema);

/**
 * Validates our own parser's output right before storage (see file header —
 * this is an invariant assertion now, not a client-input trust boundary).
 * Returns null when valid, or a short human-readable error string when
 * not — callers turn that into a 500 ("please report this") rather than
 * persisting a tree the rest of the pipeline isn't guaranteed to handle.
 */
export function validateBlocks(blocks: unknown): string | null {
  const result = BlocksArraySchema.safeParse(blocks);
  if (result.success) return null;
  const first = result.error.issues[0];
  const path = first?.path?.length ? ` at blocks[${first.path.join(".")}]` : "";
  return `Invalid block content${path}: ${first?.message ?? "unknown validation error"}`;
}
