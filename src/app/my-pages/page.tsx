import { AppLogo } from "@/components/ui/AppLogo";
import { ROUTES } from "@/lib/constants";
import Link from "next/link";

export const metadata = { title: "My pages — Readable" };

export default function MyPagesPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary flex flex-col">
      <header className="border-b border-border-subtle">
        <div className="mx-auto w-full max-w-5xl px-4 py-3">
          <Link href={ROUTES.home}>
            <AppLogo onlyIcon={false} />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 gap-4 text-center">
        <div className="text-4xl">📄</div>
        <h1 className="text-xl font-semibold">My pages</h1>
        <p className="text-sm text-text-secondary max-w-xs">
          Your published pages will appear here. This dashboard is coming soon.
        </p>
        <Link
          href={ROUTES.app}
          className="mt-2 inline-flex items-center gap-1.5 rounded-pill border border-outline px-4 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent-soft/50 hover:text-text-primary"
        >
          Back to editor
        </Link>
      </main>
    </div>
  );
}
