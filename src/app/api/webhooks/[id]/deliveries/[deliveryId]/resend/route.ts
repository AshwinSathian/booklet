import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { getSession } from "@/lib/auth/session";
import { getWebhook, getWebhookDelivery } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendToWebhook } from "@/lib/webhook-delivery";
import { unverifiedResponse } from "@/server/verification";
import { problem } from "@/server/errors";

export const runtime = "nodejs";

/**
 * Sends a logged delivery's body to its webhook again and logs the new
 * attempt. Owner-only: the webhook and the delivery are both looked up by
 * the caller's user id, so someone else's ids answer 404.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; deliveryId: string }> }) {
  if (!isSameOriginRequest(req)) return problem(403, "Forbidden");
  const userId = (await getSession())?.userId ?? null;
  if (!userId) return problem(401, "Unauthorized");

  const unverified = await unverifiedResponse(userId);
  if (unverified) return unverified;

  // Each call makes one outbound request.
  const limited = await checkRateLimit(`webhook_resend__${userId}`, 20);
  if (limited) return limited;

  const { id, deliveryId } = await params;
  const webhook = await getWebhook(id, userId);
  const delivery = webhook ? await getWebhookDelivery(deliveryId, id, userId) : null;
  if (!webhook || !delivery) return problem(404, "Delivery not found");

  const sent = await sendToWebhook(webhook, delivery.event, delivery.page_id, delivery.body);
  return NextResponse.json(
    { delivery: { id: sent.id, event: sent.event, page_id: sent.page_id, status_code: sent.status_code, ok: sent.ok, error: sent.error, created_at: sent.created_at } },
    { status: 201 },
  );
}
