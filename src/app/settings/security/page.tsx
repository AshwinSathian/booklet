import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { enabledSsoProviders } from "@/lib/auth/sso";
import { ROUTES } from "@/lib/constants";
import { countUserSessions, getIdentitiesByUser, getPasskeysByUser, getUserById } from "@/lib/db/auth";
import { listConnectedApps } from "@/lib/oauth/server";
import { formatDateUTC } from "@/lib/ui/time";
import { SettingsShell, SettingsTitle } from "../SettingsShell";
import { SecurityClient } from "./SecurityClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sign-in and security · Booklet",
  robots: { index: false, follow: false },
};

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Middleware only does a cheap cookie-presence redirect; this is the
  // authoritative check.
  const session = await getSession();
  const user = session ? await getUserById(session.userId) : null;
  if (!user) redirect(ROUTES.signIn);

  const [identities, passkeys, apps, sessions, { error }] = await Promise.all([
    getIdentitiesByUser(user.id),
    getPasskeysByUser(user.id),
    listConnectedApps(user.id),
    countUserSessions(user.id),
    searchParams,
  ]);

  return (
    <SettingsShell current={ROUTES.security}>
      <SettingsTitle title="Sign-in and security">How you sign in, where you are signed in, and the apps that act as you.</SettingsTitle>
      <SecurityClient
        hasPassword={Boolean(user.password_hash)}
        providers={enabledSsoProviders().map((p) => ({ ...p, connected: identities.some((i) => i.provider === p.id) }))}
        // Dates are written out here: the server and the browser then show the same text.
        passkeys={passkeys.map((p) => ({ id: p.id, name: p.name, added: formatDateUTC(p.created_at), lastUsed: p.last_used_at ? formatDateUTC(p.last_used_at) : null }))}
        apps={apps}
        sessions={sessions}
        errorCode={error}
      />
    </SettingsShell>
  );
}
