import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ROUTES } from "@/lib/constants";
import { getApiKeysByUser } from "@/lib/db";
import { SettingsShell } from "../SettingsShell";
import { ApiKeysSection } from "./ApiKeysClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "API keys — Booklet",
  robots: { index: false, follow: false },
};

export default async function ApiKeysPage() {
  // Middleware only does a cheap cookie-presence redirect; this is the
  // authoritative check.
  const userId = (await getSession())?.userId ?? null;
  if (!userId) redirect(ROUTES.signIn);

  const keys = await getApiKeysByUser(userId);
  return (
    <SettingsShell current={ROUTES.apiKeys}>
      <ApiKeysSection
        initialKeys={keys.map((k) => ({
          id: k.id,
          label: k.label,
          created_at: k.created_at,
          last_used_at: k.last_used_at,
        }))}
      />
    </SettingsShell>
  );
}
