import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";
import { isAppleDevice } from "@/lib/clerk-appearance";
import { buildMetadata } from "@/lib/seo";
import { SignIn } from "@clerk/nextjs";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { PasskeySignInButton } from "./PasskeySignInButton";

export const metadata: Metadata = buildMetadata({
  title: "Sign in",
  description:
    "Sign in to Readable. Keep your published pages permanently, edit them in place, unlock analytics, version history, and the REST API.",
  pathname: "/sign-in",
  noIndex: true,
});

// Only allow relative paths as redirect targets — prevents open-redirect abuse
function isSafeRedirect(url: string | undefined): url is string {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//");
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const [{ redirect_url }, hdrs] = await Promise.all([searchParams, headers()]);
  const forceRedirectUrl = isSafeRedirect(redirect_url) ? redirect_url : undefined;
  const apple = isAppleDevice(hdrs.get("user-agent") ?? "");

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-md px-4 py-3">
          <Link href={ROUTES.home}>
            <AppLogo onlyIcon={false} />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-5">
        <div className="text-center">
          <p className="text-sm text-text-secondary">
            {forceRedirectUrl?.startsWith("/cli-auth")
              ? "Sign in to authorize the Readable CLI."
              : "Sign in to keep your pages forever and access them anywhere."}
          </p>
        </div>

        {/* Passkey button — renders only when WebAuthn is supported in the browser */}
        <PasskeySignInButton />

        <SignIn {...(forceRedirectUrl ? { forceRedirectUrl } : {})} />

        {apple ? (
          <p className="text-xs text-text-muted text-center max-w-xs">
            On this Apple device you can also use{" "}
            <span className="font-medium text-text-secondary">Touch ID / Face ID</span>{" "}
            via a passkey — register one after signing in from{" "}
            <Link href={ROUTES.myPages} className="text-accent hover:text-accent-soft transition-colors">
              My Pages → Security
            </Link>.
          </p>
        ) : null}

        <p className="text-xs text-text-muted text-center">
          No account?{" "}
          <Link
            href={ROUTES.app}
            className="text-accent hover:text-accent-soft transition-colors"
          >
            Just write and publish — no sign-in needed.
          </Link>
        </p>
      </main>
    </div>
  );
}
