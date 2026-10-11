import { AuthLayout } from "@/components/auth/AuthLayout";
import { ROUTES } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import { isSafeRedirect } from "@/lib/safe-redirect";
import { getSession } from "@/lib/auth/session";
import { enabledSsoProviders } from "@/lib/auth/sso";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthForm } from "../sign-in/AuthForm";

export const metadata: Metadata = buildMetadata({
  title: "Create an account",
  description:
    "Create a free Booklet account: no monthly cap, editing in place, team spaces, version history, analytics and the API. There is no paid plan.",
  pathname: "/sign-up",
  noIndex: true,
});

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string; error?: string }>;
}) {
  const { redirect_url, error } = await searchParams;
  const redirectUrl = isSafeRedirect(redirect_url) ? redirect_url : undefined;

  // Already signed in — see src/app/sign-in/page.tsx for why this redirects
  // straight through instead of re-showing the form.
  const session = await getSession();
  if (session) {
    redirect(redirectUrl ?? ROUTES.app);
  }

  return (
    <AuthLayout title="Create your account">
      <div className="text-center">
        <p className="text-sm text-text-secondary">
          {redirectUrl?.startsWith("/cli-auth")
            ? "Create an account to authorize the Booklet CLI."
            : "An account removes the monthly cap and lets you edit a page after publishing. You confirm your email address before the first publish."}
        </p>
      </div>

      <AuthForm mode="sign-up" redirectUrl={redirectUrl} providers={enabledSsoProviders()} errorCode={error} />

      <p className="text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link
          href={redirectUrl ? `${ROUTES.signIn}?redirect_url=${encodeURIComponent(redirectUrl)}` : ROUTES.signIn}
          className="link"
        >
          Sign in
        </Link>
        <br />
        Or{" "}
        <Link href={ROUTES.app} className="link">
          publish without an account
        </Link>
      </p>
    </AuthLayout>
  );
}
