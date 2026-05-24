import { getDb } from "@/lib/mongodb";
import type { DbReaction } from "./types";

const VALID_EMOJIS = new Set(["👍", "🔥", "💡", "❤️"]);
const MAX_COUNT = 1_000_000;

type ReactionDoc = Omit<DbReaction, "page_id"> & { _id: string };

function docKey(pageId: string, emoji: string) {
  return `${pageId}:${emoji}`;
}

export async function getPageReactions(pageId: string): Promise<Record<string, number>> {
  const db = await getDb();
  const docs = await db
    .collection<{ _id: string; count: number }>("reactions")
    .find({ _id: { $regex: `^${pageId}:` } })
    .toArray();

  const out: Record<string, number> = {};
  for (const doc of docs) {
    const emoji = doc._id.split(":").slice(1).join(":");
    out[emoji] = doc.count;
  }
  return out;
}

export async function incrementReaction(pageId: string, emoji: string): Promise<number> {
  if (!VALID_EMOJIS.has(emoji)) throw new Error("Invalid emoji");
  const db = await getDb();
  const result = await db
    .collection<ReactionDoc>("reactions")
    .findOneAndUpdate(
      { _id: docKey(pageId, emoji) as unknown as string, count: { $lt: MAX_COUNT } },
      { $inc: { count: 1 } },
      { upsert: true, returnDocument: "after" },
    );
  return result?.count ?? 1;
}

export async function decrementReaction(pageId: string, emoji: string): Promise<number> {
  if (!VALID_EMOJIS.has(emoji)) throw new Error("Invalid emoji");
  const db = await getDb();
  const result = await db
    .collection<ReactionDoc>("reactions")
    .findOneAndUpdate(
      { _id: docKey(pageId, emoji) as unknown as string, count: { $gt: 0 } },
      { $inc: { count: -1 } },
      { returnDocument: "after" },
    );
  return result?.count ?? 0;
}

export { VALID_EMOJIS };
