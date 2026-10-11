import { Container, PageShell } from "@/components/marketing/primitives";
import { Button } from "@/components/ui/Button";
import { buildMetadata } from "@/lib/seo";
import { EXAMPLES_ORIGIN, ROUTES } from "@/lib/constants";

const EXAMPLES = [
  { label: "An incident report", href: `${EXAMPLES_ORIGIN}/p/example-incident-report` },
  { label: "An architecture decision record", href: `${EXAMPLES_ORIGIN}/p/example-adr` },
  { label: "A README", href: `${EXAMPLES_ORIGIN}/p/example-readme` },
];

/** Shown, with status 404, when a share page does not exist. */
export const metadata = buildMetadata({ title: "Page not found", noIndex: true });

export default function SharePageNotFound() {
  return (
    <PageShell>
      <Container className="py-24 sm:py-28">
        <p className="font-mono text-sm text-text-muted">404</p>
        <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.025em]">
          This page does not exist.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-text-secondary">
          The link may be wrong, or its author deleted the page.
        </p>
        <div className="mt-8">
          <Button variant="primary" size="lg" href={ROUTES.app}>
            Write a page
          </Button>
        </div>
        <h2 className="mt-14 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Pages that do exist</h2>
        <ul className="prose-typeset mt-3 flex flex-col gap-2">
          {EXAMPLES.map((example) => (
            <li key={example.href}>
              <a href={example.href}>{example.label}</a>
            </li>
          ))}
        </ul>
      </Container>
    </PageShell>
  );
}
