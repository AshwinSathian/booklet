import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <AppLogo />
      <div>
        <p className="font-mono text-sm text-text-muted">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">Page not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This page doesn't exist, or it was never published.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="primary" size="md" href={ROUTES.home}>Go home</Button>
        <Button variant="secondary" size="md" href={ROUTES.app}>Write a page</Button>
      </div>
    </main>
  );
}
