import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { getWebhookDeliveries, getWebhooksByUser } from "@/lib/db";
import { SettingsShell } from "../SettingsShell";
import { WebhooksSection } from "./WebhooksClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Webhooks — Booklet",
  robots: { index: false, follow: false },
};

export default async function WebhooksPage() {
  // Middleware only does a cheap cookie-presence redirect; this is the
  // authoritative check.
  const userId = (await getSession())?.userId ?? null;
  if (!userId) redirect(ROUTES.signIn);

  // At most 5 webhooks, each with at most 50 logged deliveries. The log
  // names the owner's own pages only: every row is read by `user_id`.
  const webhooks = await Promise.all(
    (await getWebhooksByUser(userId)).map(async (w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      created_at: w.created_at,
      last_triggered_at: w.last_triggered_at,
      deliveries: (await getWebhookDeliveries(w.id, userId)).map(toDeliveryRow),
    })),
  );

  return (
    <SettingsShell current={ROUTES.webhooks}>
      <WebhooksSection initialWebhooks={webhooks} />
    </SettingsShell>
  );
}

/** What the browser gets of a delivery: the signed body stays on the server. */
function toDeliveryRow(d: Awaited<ReturnType<typeof getWebhookDeliveries>>[number]) {
  return { id: d.id, event: d.event, page_id: d.page_id, status_code: d.status_code, ok: d.ok, error: d.error, created_at: d.created_at };
}
