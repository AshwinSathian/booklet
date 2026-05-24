import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — Readable",
};

// Only allow relative paths as redirect targets — prevents open-redirect abuse
function isSafeRedirect(url: string | undefined): url is string {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//");
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url } = await searchParams;
  const forceRedirectUrl = isSafeRedirect(redirect_url) ? redirect_url : undefined;

  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-md px-4 py-3">
          <Link href={ROUTES.home}>
            <AppLogo onlyIcon={false} />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-6">
        <div className="text-center">
          <p className="text-sm text-text-secondary">
            {forceRedirectUrl?.startsWith("/cli-auth")
              ? "Sign in to authorize the Readable CLI."
              : "Sign in to keep your pages forever and access them anywhere."}
          </p>
        </div>
        <SignIn {...(forceRedirectUrl ? { forceRedirectUrl } : {})} />
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
