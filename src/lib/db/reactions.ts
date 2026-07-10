import { getDb } from "@/lib/mongodb";
import type { DbReaction } from "./types";

const VALID_EMOJIS = new Set(["👍", "🔥", "💡", "❤️"]);
const MAX_COUNT = 1_000_000;

type ReactionDoc = DbReaction & { _id: string };

type ReactionStateDoc = {
  session_hash: string;
  page_id: string;
  emoji: string;
  created_at: string;
};

// pageId is always a route param / user-controlled string that ends up in a
// MongoDB query and (for incrementReaction/decrementReaction) directly in an
// `_id` value. It's produced by createId() (see src/lib/id.ts) — always a
// short alphanumeric string — so anything else is not a legitimate page id.
// This is defense-in-depth, not the primary fix: the primary fix is that
// getPageReactions below no longer builds a regex out of it at all.
const PAGE_ID_RE = /^[0-9A-Za-z]{1,64}$/;

function isValidPageId(pageId: string): boolean {
  return PAGE_ID_RE.test(pageId);
}

function docKey(pageId: string, emoji: string) {
  return `${pageId}:${emoji}`;
}

export async function getPageReactions(pageId: string): Promise<Record<string, number>> {
  if (!isValidPageId(pageId)) return {};

  const db = await getDb();
  const docs = await db
    .collection<ReactionDoc>("reactions")
    // Equality match on an indexed `page_id` field — not a $regex prefix
    // scan over `_id`. A regex built from an unvalidated route param let a
    // crafted pageId (regex metacharacters / alternation) over-match other
    // pages' reaction docs, or cause ReDoS via a pathological pattern.
    .find({ page_id: pageId })
    .toArray();

  const out: Record<string, number> = {};
  for (const doc of docs) {
    out[doc.emoji] = doc.count;
  }
  return out;
}

export async function incrementReaction(pageId: string, emoji: string): Promise<number> {
  if (!isValidPageId(pageId)) throw new Error("Invalid pageId");
  if (!VALID_EMOJIS.has(emoji)) throw new Error("Invalid emoji");
  const db = await getDb();
  const result = await db
    .collection<ReactionDoc>("reactions")
    .findOneAndUpdate(
      { _id: docKey(pageId, emoji) as unknown as string, count: { $lt: MAX_COUNT } },
      {
        $inc: { count: 1 },
        // Populate page_id/emoji on every write (new doc or pre-existing —
        // pre-existing docs from before this fix only had the composite
        // `_id`, no page_id field) so getPageReactions' equality match
        // above stays correct for both.
        $set: { page_id: pageId, emoji },
      },
      { upsert: true, returnDocument: "after" },
    );
  return result?.count ?? 1;
}

export async function decrementReaction(pageId: string, emoji: string): Promise<number> {
  if (!isValidPageId(pageId)) throw new Error("Invalid pageId");
  if (!VALID_EMOJIS.has(emoji)) throw new Error("Invalid emoji");
  const db = await getDb();
  const result = await db
    .collection<ReactionDoc>("reactions")
    .findOneAndUpdate(
      { _id: docKey(pageId, emoji) as unknown as string, count: { $gt: 0 } },
      {
        $inc: { count: -1 },
        $set: { page_id: pageId, emoji },
      },
      { returnDocument: "after" },
    );
  return result?.count ?? 0;
}

async function getCurrentCount(pageId: string, emoji: string): Promise<number> {
  const db = await getDb();
  const doc = await db
    .collection<ReactionDoc>("reactions")
    .findOne({ _id: docKey(pageId, emoji) as unknown as string });
  return doc?.count ?? 0;
}

/**
 * Session-scoped toggle-on: increments the shared count only the first time
 * a given session reacts with `emoji` on `pageId`. Repeated "add" clicks
 * from the same session/page/emoji (same tab spamming the button, multiple
 * tabs, a replayed request) are no-ops against the count — they don't keep
 * incrementing it.
 *
 * Design: a small `reaction_state` collection tracks "has this session
 * reacted with this emoji on this page" as a boolean fact (one doc per
 * session+page+emoji), separate from the `reactions` count collection.
 * A single dedupe-by-unique-index upsert (the pattern analytics_events
 * uses for one-shot events) isn't quite the right shape here because
 * reactions are meant to be toggleable — add, then remove, then add again
 * must all be legal — so we need explicit per-session state we can both
 * insert *and delete*, not just insert-once. `updateOne`'s `upsertedCount`
 * tells us atomically whether this session's state doc was newly created
 * (first reaction this session -> bump the count) or already existed
 * (repeat click -> no-op, just report the current count).
 */
export async function addReactionForSession(
  pageId: string,
  emoji: string,
  sessionHash: string,
): Promise<number> {
  if (!isValidPageId(pageId)) throw new Error("Invalid pageId");
  if (!VALID_EMOJIS.has(emoji)) throw new Error("Invalid emoji");

  const db = await getDb();
  const stateResult = await db
    .collection<ReactionStateDoc>("reaction_state")
    .updateOne(
      { session_hash: sessionHash, page_id: pageId, emoji },
      {
        $setOnInsert: {
          session_hash: sessionHash,
          page_id: pageId,
          emoji,
          created_at: new Date().toISOString(),
        },
      },
      { upsert: true },
    );

  if (stateResult.upsertedCount === 0) {
    // Already reacted this session/page/emoji — no-op.
    return getCurrentCount(pageId, emoji);
  }

  return incrementReaction(pageId, emoji);
}

/**
 * Session-scoped toggle-off: mirrors addReactionForSession. Only decrements
 * the shared count if this session had actually recorded a reaction here —
 * `deleteOne`'s `deletedCount` tells us atomically whether a state doc
 * existed. This also closes a separate abuse path: without this check, any
 * visitor could POST `{ action: "remove" }` repeatedly and decrement other
 * visitors' reactions down to zero even without ever having reacted
 * themselves.
 */
export async function removeReactionForSession(
  pageId: string,
  emoji: string,
  sessionHash: string,
): Promise<number> {
  if (!isValidPageId(pageId)) throw new Error("Invalid pageId");
  if (!VALID_EMOJIS.has(emoji)) throw new Error("Invalid emoji");

  const db = await getDb();
  const deleteResult = await db
    .collection<ReactionStateDoc>("reaction_state")
    .deleteOne({ session_hash: sessionHash, page_id: pageId, emoji });

  if (deleteResult.deletedCount === 0) {
    // This session never recorded a reaction here — no-op.
    return getCurrentCount(pageId, emoji);
  }

  return decrementReaction(pageId, emoji);
}

export { VALID_EMOJIS, isValidPageId };
