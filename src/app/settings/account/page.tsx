import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { enabledSsoProviders } from "@/lib/auth/sso";
import { ROUTES } from "@/lib/constants";
import { getIdentitiesByUser, getPasskeysByUser, getUserById } from "@/lib/db/auth";
import { formatDateUTC } from "@/lib/ui/time";
import { emailVerificationRequired } from "@/server/verification";
import { SettingsShell, SettingsTitle } from "../SettingsShell";
import { AccountClient } from "./AccountClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Account · Booklet",
  robots: { index: false, follow: false },
};

/** "Password, GitHub and 2 passkeys": the ways this account can sign in, in words. */
function signInSummary(parts: string[]): string {
  if (parts.length === 0) return "None";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export default async function AccountPage() {
  // Middleware only does a cheap cookie-presence redirect; this is the
  // authoritative check.
  const session = await getSession();
  const user = session ? await getUserById(session.userId) : null;
  if (!user) redirect(ROUTES.signIn);

  const [identities, passkeys] = await Promise.all([getIdentitiesByUser(user.id), getPasskeysByUser(user.id)]);
  const providers = enabledSsoProviders().filter((p) => identities.some((i) => i.provider === p.id));
  const methods = [
    ...(user.password_hash ? ["Password"] : []),
    ...providers.map((p) => p.label),
    ...(passkeys.length ? [passkeys.length === 1 ? "1 passkey" : `${passkeys.length} passkeys`] : []),
  ];
  const verifying = emailVerificationRequired();

  return (
    <SettingsShell current={ROUTES.account}>
      <SettingsTitle title="Account">Your email address, your pages as a download, and deleting the account.</SettingsTitle>
      <AccountClient
        email={user.email}
        // Shown only where verification is enforced: elsewhere no address is ever confirmed.
        emailState={verifying ? (user.email_verified_at ? "confirmed" : "unconfirmed") : null}
        hasPassword={Boolean(user.password_hash)}
        memberSince={formatDateUTC(user.created_at)}
        signInSummary={signInSummary(methods)}
      />
    </SettingsShell>
  );
}
