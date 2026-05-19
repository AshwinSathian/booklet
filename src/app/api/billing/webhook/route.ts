import { getStripe } from "@/lib/stripe";
import { setUserPlan, getUserByStripeCustomerId } from "@/lib/db";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Stripe requires the raw body for signature verification.
// Next.js App Router does not buffer the body by default — we read it as text.
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return new Response("Webhook secret not configured", { status: 500 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = typeof session.customer === "string" ? session.customer : (session.customer as Stripe.Customer | null)?.id ?? null;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : (session.subscription as Stripe.Subscription | null)?.id ?? null;
        if (userId && customerId && subscriptionId) {
          await setUserPlan(userId, "pro", customerId, subscriptionId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as Stripe.Customer).id;
        const isActive = sub.status === "active" || sub.status === "trialing";
        if (!isActive) {
          const user = await getUserByStripeCustomerId(customerId);
          if (user) await setUserPlan(user.id, "free");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as Stripe.Customer).id;
        const user = await getUserByStripeCustomerId(customerId);
        if (user) await setUserPlan(user.id, "free");
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : (invoice.customer as Stripe.Customer | null)?.id ?? null;
        if (customerId) {
          const user = await getUserByStripeCustomerId(customerId);
          if (user) await setUserPlan(user.id, "free");
        }
        break;
      }
    }
  } catch (err) {
    console.error("[billing/webhook] handler error:", err);
    // Return 200 so Stripe doesn't retry — log the error internally
  }

  return new Response(null, { status: 200 });
}
