import { getPageRecord } from "@/lib/db";
import { registerExpiryNotification } from "@/lib/db/expiry-notifications";
import { sendExpiryConfirmationEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/seo";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`notify_expiry__${ip}`, 5).catch(() => null);
  if (rl) return rl;

  let body: { pageId?: string; email?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { pageId, email } = body;
  if (!pageId?.trim()) return NextResponse.json({ error: "Missing pageId" }, { status: 400 });
  if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  // Only notify for anonymous (non-owned) pages
  const page = await getPageRecord(pageId).catch(() => null);
  if (page) {
    // Signed-in page — doesn't expire, no notification needed
    return NextResponse.json({ ok: true, message: "permanent" });
  }

  const pageUrl = absoluteUrl(`/p/${pageId}`);
  await registerExpiryNotification(pageId, email, pageUrl);

  // Send immediate confirmation with the page link
  void sendExpiryConfirmationEmail(email, pageUrl).catch(console.error);

  return NextResponse.json({ ok: true });
}
