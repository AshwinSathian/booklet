import { getDb } from "@/lib/mongodb";

const COLLECTION = "expiry_notifications";
const ANONYMOUS_TTL_DAYS = 30;
const NOTIFY_DAYS_BEFORE = 5;

type NotificationDoc = {
  _id: string;       // pageId
  email: string;
  page_url: string;
  expires_at: string;
  notified_at: string | null;
  created_at: string;
};

export async function registerExpiryNotification(
  pageId: string,
  email: string,
  pageUrl: string,
): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ANONYMOUS_TTL_DAYS * 86400 * 1000);

  await db.collection<NotificationDoc>(COLLECTION).updateOne(
    { _id: pageId as unknown as string },
    {
      $set: { email, page_url: pageUrl, expires_at: expiresAt.toISOString() },
      $setOnInsert: { _id: pageId as unknown as string, notified_at: null, created_at: now.toISOString() },
    },
    { upsert: true },
  );
}

export async function getPendingExpiryNotifications(): Promise<NotificationDoc[]> {
  const db = await getDb();
  const threshold = new Date(Date.now() + NOTIFY_DAYS_BEFORE * 86400 * 1000);

  return db
    .collection<NotificationDoc>(COLLECTION)
    .find({
      notified_at: null,
      expires_at: { $lte: threshold.toISOString() },
    })
    .limit(100)
    .toArray();
}

export async function markNotified(pageId: string): Promise<void> {
  const db = await getDb();
  await db
    .collection<NotificationDoc>(COLLECTION)
    .updateOne(
      { _id: pageId as unknown as string },
      { $set: { notified_at: new Date().toISOString() } },
    );
}
