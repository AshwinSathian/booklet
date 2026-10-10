import { getDb } from "@/lib/mongodb";
import type { PublishEvent } from "./types";

type ContentBucket = PublishEvent["content_length_bucket"];

function bucketContentLength(charCount: number): ContentBucket {
  if (charCount < 500) return "xs";
  if (charCount < 2_000) return "sm";
  if (charCount < 10_000) return "md";
  if (charCount < 50_000) return "lg";
  return "xl";
}

export async function recordPublishEvent(opts: {
  userId: string | null;
  pageId: string;
  isUpdate: boolean;
  contentLength: number;
  source: PublishEvent["source"];
  richBlockKinds?: string[];
}): Promise<void> {
  const db = await getDb();
  await db.collection<PublishEvent>("publish_events").insertOne({
    id: crypto.randomUUID(),
    user_id: opts.userId,
    page_id: opts.pageId,
    is_update: opts.isUpdate,
    content_length_bucket: bucketContentLength(opts.contentLength),
    source: opts.source,
    created_at: new Date().toISOString(),
    ...(opts.richBlockKinds?.length ? { rich_block_kinds: opts.richBlockKinds } : {}),
  });
  // My pages shows this per row. After the insert, so a failure here never
  // costs the log its event. An anonymous publish has no page record, and
  // the update then matches nothing.
  await db.collection<{ _id: string }>("pages").updateOne({ _id: opts.pageId }, { $set: { last_source: opts.source } });
}
