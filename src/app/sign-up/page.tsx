import { AuthLayout } from "@/components/auth/AuthLayout";
import { ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import { isSafeRedirect } from "@/lib/safe-redirect";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "../sign-in/AuthForm";

export const metadata: Metadata = buildMetadata({
  title: "Create free account",
  description:
    "Create a free Booklet account. Publish without a monthly cap, edit pages in place, get analytics, version history, and full API access. No credit card required.",
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

  // Already signed in — see src/app/sign-in/page.tsx for why this redirects
  // straight through instead of re-showing the form.
  const session = await getSession();
  if (session) {
    redirect(redirectUrl ?? ROUTES.app);
  }

  return (
    <AuthLayout>
      <div className="text-center">
        <p className="text-sm text-text-secondary">
          {redirectUrl?.startsWith("/cli-auth")
            ? "Create a free account to authorize the Booklet CLI."
            : "Create a free account. No monthly publish cap. Edit pages in place, from anywhere."}
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
    </AuthLayout>
  );
}
