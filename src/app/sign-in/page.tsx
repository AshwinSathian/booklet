import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import { isSafeRedirect } from "@/lib/safe-redirect";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = buildMetadata({
  title: "Sign in",
  description:
    "Sign in to Readable. Keep your published pages permanently, edit them in place, unlock analytics, version history, and the REST API.",
  pathname: "/sign-in",
  noIndex: true,
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const redirectUrl = isSafeRedirect(redirect_url) ? redirect_url : undefined;

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-md px-4 py-3">
          <AppLogo onlyIcon={false} />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-5">
        <div className="text-center">
          <p className="text-sm text-text-secondary">
            {redirectUrl?.startsWith("/cli-auth")
              ? "Sign in to authorize the Readable CLI."
              : "Sign in to keep your pages forever and access them anywhere."}
          </p>
        </div>

        <AuthForm mode="sign-in" redirectUrl={redirectUrl} />

        <p className="text-xs text-text-muted text-center">
          No account?{" "}
          <Link
            href={redirectUrl ? `${ROUTES.signUp}?redirect_url=${encodeURIComponent(redirectUrl)}` : ROUTES.signUp}
            className="text-accent hover:text-accent-soft transition-colors"
          >
            Create one
          </Link>{" "}
          or{" "}
          <Link href={ROUTES.app} className="text-accent hover:text-accent-soft transition-colors">
            just write and publish — no sign-in needed
          </Link>.
        </p>
      </main>
    </div>
  );
}
