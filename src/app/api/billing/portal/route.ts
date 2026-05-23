import { auth } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { getUser } from "@/lib/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUser(userId);
  if (!user?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found." }, { status: 404 });
  }

  const returnUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/my-pages`;

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: returnUrl,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to open billing portal";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
