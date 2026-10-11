/**
 * Booklet's own error tracking: every logError is also counted here, by
 * fingerprint, for the admin page and an optional email alert. No outside
 * service, so nothing to configure and nothing to hide when unconfigured.
 *
 * One row per distinct error (scope, message, error name and the first
 * frame of its stack), with a count and first and last sighting. A row
 * expires 30 days after its last sighting (TTL index on `last_seen`).
 *
 * Nothing here may call logError: a failure to record an error must not
 * become an error to record.
 */

import { createHash } from "node:crypto";
import { getDb } from "@/lib/mongodb";

export type ErrorEvent = {
  _id: string;
  scope: string;
  message: string;
  error_name: string | null;
  error_message: string | null;
  stack: string | null;
  count: number;
  first_seen: Date;
  last_seen: Date;
  /** When the alert email for this fingerprint last went out. */
  alerted_at: Date | null;
};

type Fields = { name?: unknown; message?: unknown; stack?: unknown } | undefined;

const MAX_TEXT = 2000;
const ALERT_EVERY_MS = 24 * 60 * 60 * 1000;
const MAX_ALERTS_PER_HOUR = 10;
let alertWindow = { startedAt: 0, sent: 0 };

const text = (v: unknown): string | null => (typeof v === "string" && v ? v.slice(0, MAX_TEXT) : null);

/** The first stack line that is a frame: where it was thrown, stable across messages that carry ids. */
function firstFrame(stack: string | null): string {
  return stack?.split("\n").find((l) => l.trimStart().startsWith("at "))?.trim() ?? "";
}

export function errorFingerprint(scope: string, message: string, errorName: string | null, stack: string | null): string {
  return createHash("sha256").update([scope, message, errorName ?? "", firstFrame(stack)].join("\n")).digest("hex").slice(0, 32);
}

/**
 * Counts one logged error, and emails `ERROR_ALERT_EMAIL` the first time a
 * fingerprint is seen and then at most once a day for it (and ten mails an
 * hour in all). Never throws.
 */
export async function recordErrorEvent(scope: string, message: string, error: Fields): Promise<void> {
  try {
    const errorName = text(error?.name);
    const stack = text(error?.stack);
    const now = new Date();
    const _id = errorFingerprint(scope, message, errorName, stack);
    const col = (await getDb()).collection<ErrorEvent>("error_events");
    const before = await col.findOneAndUpdate(
      { _id },
      {
        $set: { last_seen: now, error_message: text(error?.message), stack },
        $inc: { count: 1 },
        $setOnInsert: { scope: scope.slice(0, 200), message: message.slice(0, MAX_TEXT), error_name: errorName, first_seen: now, alerted_at: null },
      },
      { upsert: true, returnDocument: "before" },
    );

    const to = process.env.ERROR_ALERT_EMAIL?.trim();
    if (!to || !process.env.RESEND_API_KEY) return;
    // Claimed in one write, so of many requests hitting the same new error
    // at once, one sends the mail.
    const cutoff = new Date(now.getTime() - ALERT_EVERY_MS);
    const claim = await col.updateOne({ _id, $or: [{ alerted_at: null }, { alerted_at: { $lt: cutoff } }] }, { $set: { alerted_at: now } });
    if (claim.modifiedCount !== 1) return;
    const release = () => col.updateOne({ _id, alerted_at: now }, { $set: { alerted_at: before?.alerted_at ?? null } });

    if (now.getTime() - alertWindow.startedAt > 60 * 60 * 1000) alertWindow = { startedAt: now.getTime(), sent: 0 };
    if (alertWindow.sent >= MAX_ALERTS_PER_HOUR) {
      await release(); // not sent: let the next sighting try, once the hour's cap has room
      return;
    }
    alertWindow.sent++;
    try {
      const { sendErrorAlertEmail } = await import("@/lib/email");
      await sendErrorAlertEmail(to, { scope, message, errorMessage: text(error?.message), stack, count: (before?.count ?? 0) + 1, firstSeen: before?.first_seen ?? now });
    } catch {
      await release();
    }
  } catch {
    /* see the note at the top of this file */
  }
}

/** The errors seen most recently, for the admin page. */
export async function listErrorEvents(limit = 25): Promise<ErrorEvent[]> {
  return (await getDb()).collection<ErrorEvent>("error_events").find({}).sort({ last_seen: -1 }).limit(limit).toArray();
}
