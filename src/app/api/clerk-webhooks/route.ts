import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { sendWelcomeEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(req);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const { email_addresses, first_name } = event.data;
    const primaryEmail = email_addresses?.find((e) => e.id === event.data.primary_email_address_id)?.email_address;
    if (primaryEmail) {
      void sendWelcomeEmail(primaryEmail, first_name ?? undefined).catch((err) => {
        console.error("[clerk-webhook] welcome email failed:", err);
      });
    }
  }

  return NextResponse.json({ ok: true });
}
