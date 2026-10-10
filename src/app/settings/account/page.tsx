import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { AppLogo } from "@/components/ui/AppLogo";
import { getSession } from "@/lib/auth/session";
import { enabledSsoProviders } from "@/lib/auth/sso";
import { ROUTES } from "@/lib/constants";
import { getIdentitiesByUser, getPasskeysByUser, getUserById } from "@/lib/db/auth";
import { listConnectedApps } from "@/lib/oauth/server";
import { emailVerificationRequired } from "@/server/verification";
import { AccountClient } from "./AccountClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Account — Booklet",
  robots: { index: false, follow: false },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Middleware only does a cheap cookie-presence redirect; this is the
  // authoritative check.
  const session = await getSession();
  const user = session ? await getUserById(session.userId) : null;
  if (!user) redirect(ROUTES.signIn);

  const [identities, passkeys, apps, { error }] = await Promise.all([
    getIdentitiesByUser(user.id),
    getPasskeysByUser(user.id),
    listConnectedApps(user.id),
    searchParams,
  ]);

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-3xl px-4 h-12 flex items-center justify-between gap-4">
          <AppLogo onlyIcon={false} />
          <div className="flex items-center gap-3">
            <Link
              href={ROUTES.myPages}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-pill border border-border-default px-3.5 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
            >
              My pages
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="text-xl font-medium">Account</h1>
        <p className="mt-0.5 text-sm text-text-secondary">{user.email}</p>

        <AccountClient
          email={user.email ?? ""}
          // Shown as unverified only where verification is enforced.
          needsVerification={emailVerificationRequired() && !user.email_verified_at}
          hasPassword={Boolean(user.password_hash)}
          providers={enabledSsoProviders().map((p) => ({ ...p, connected: identities.some((i) => i.provider === p.id) }))}
          passkeys={passkeys.map((p) => ({ id: p.id, name: p.name, created_at: p.created_at, last_used_at: p.last_used_at }))}
          apps={apps}
          errorCode={error}
        />
      </main>
    </div>
  );
}
