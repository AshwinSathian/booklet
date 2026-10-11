"use client";

import { Container, PageShell } from "@/components/marketing/primitives";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";

export default function ShareError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageShell>
      <Container className="py-24 sm:py-28">
        <h1 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.025em]">
          This page could not be loaded.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-text-secondary">
          Something failed while loading this page. Try again.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="primary" size="lg" onClick={reset}>
            Try again
          </Button>
          <Button variant="secondary" size="lg" href={ROUTES.home}>
            Go to the homepage
          </Button>
          <Button variant="secondary" size="lg" href={ROUTES.docs}>
            Read the docs
          </Button>
          <Button variant="secondary" size="lg" href={ROUTES.app}>
            Write a page
          </Button>
        </div>
        {error?.digest ? <p className="mt-8 font-mono text-xs text-text-muted">Ref: {error.digest}</p> : null}
      </Container>
    </PageShell>
  );
}
