import { Container, PageShell } from "@/components/marketing/primitives";
import { Button } from "@/components/ui/Button";
import { buildMetadata } from "@/lib/seo";
import { ROUTES } from "@/lib/constants";

export const metadata = buildMetadata({ title: "Page not found", noIndex: true });

export default function NotFound() {
  return (
    <PageShell>
      <Container className="py-24 sm:py-32">
        <p className="font-mono text-sm text-text-muted">404</p>
        <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.025em]">
          There is no page here.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-text-secondary">
          The address may be mistyped, or the page was never published.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button variant="primary" size="lg" href={ROUTES.home}>
            Go to the homepage
          </Button>
          <Button variant="secondary" size="lg" href={ROUTES.docs}>
            Read the docs
          </Button>
          <Button variant="secondary" size="lg" href={ROUTES.app}>
            Write a page
          </Button>
        </div>
      </Container>
    </PageShell>
  );
}
