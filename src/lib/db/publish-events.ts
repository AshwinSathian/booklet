import { getD1 } from "@/lib/d1";
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
  await getD1()
    .prepare(
      `INSERT INTO publish_events (id, user_id, page_id, is_update, content_length_bucket, source, created_at, rich_block_kinds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      opts.userId,
      opts.pageId,
      opts.isUpdate ? 1 : 0,
      bucketContentLength(opts.contentLength),
      opts.source,
      new Date().toISOString(),
      opts.richBlockKinds?.length ? JSON.stringify(opts.richBlockKinds) : null,
    )
    .run();
}
