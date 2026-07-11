import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import { isSafeRedirect } from "@/lib/safe-redirect";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "../sign-in/AuthForm";

export const metadata: Metadata = buildMetadata({
  title: "Create free account",
  description:
    "Create a free Readable account. Keep pages permanently, edit them in place, get analytics, version history, and full API access. No credit card required.",
  pathname: "/sign-up",
  noIndex: true,
});

export default async function SignUpPage({
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

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-6">
        <div className="text-center">
          <p className="text-sm text-text-secondary">
            {redirectUrl?.startsWith("/cli-auth")
              ? "Create a free account to authorize the Readable CLI."
              : "Create a free account. Keep pages permanently. Access them anywhere."}
          </p>
        </div>

        <AuthForm mode="sign-up" redirectUrl={redirectUrl} />

        <p className="text-xs text-text-muted text-center">
          Already have an account?{" "}
          <Link
            href={redirectUrl ? `${ROUTES.signIn}?redirect_url=${encodeURIComponent(redirectUrl)}` : ROUTES.signIn}
            className="text-accent hover:text-accent-soft transition-colors"
          >
            Sign in
          </Link>
          <br />
          Just want to share something quick?{" "}
          <Link href={ROUTES.app} className="text-accent hover:text-accent-soft transition-colors">
            Publish without an account →
          </Link>
        </p>
      </main>
    </div>
  );
}
