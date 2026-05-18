import { auth, currentUser } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let priceId: string;
  try {
    const body = (await req.json()) as { priceId?: string };
    if (!body.priceId) throw new Error("missing priceId");
    priceId = body.priceId;
  } catch {
    return NextResponse.json({ error: "Provide { priceId }" }, { status: 400 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? undefined;

  const returnUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/my-pages`;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      allow_promotion_codes: true,
      success_url: `${returnUrl}?checkout=success`,
      cancel_url: `${returnUrl}?checkout=cancelled`,
      metadata: { userId },
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
