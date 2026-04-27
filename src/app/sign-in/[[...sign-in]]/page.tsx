import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
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
            Sign in to keep your pages and access them anywhere.
          </p>
        </div>
        <SignIn />
        <p className="text-xs text-text-muted text-center">
          No account?{" "}
          <Link href={ROUTES.app} className="text-accent hover:text-accent-soft transition-colors">
            Just paste and publish — no sign-in needed.
          </Link>
        </p>
      </main>
    </div>
  );
}
