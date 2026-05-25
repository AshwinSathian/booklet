import { getPendingExpiryNotifications, markNotified } from "@/lib/db/expiry-notifications";
import { sendExpiryReminderEmail } from "@/lib/email";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Called by a cron job (e.g. Cloudflare Cron Triggers, Vercel Cron, or any external scheduler)
// Recommended: run once daily
// Protect with CRON_SECRET env var to prevent unauthorized calls
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const pending = await getPendingExpiryNotifications().catch(() => []);
  let sent = 0;
  let failed = 0;

  for (const record of pending) {
    const daysLeft = Math.max(
      1,
      Math.ceil((new Date(record.expires_at).getTime() - Date.now()) / 86400000),
    );

    try {
      await sendExpiryReminderEmail(record.email, record.page_url, daysLeft);
      await markNotified(String(record._id));
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed, total: pending.length });
}
