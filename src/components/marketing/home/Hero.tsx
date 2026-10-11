import { ProductShot, type ShotData } from "@/components/marketing/ProductShot";
import { Container, Mark } from "@/components/marketing/primitives";
import { Button } from "@/components/ui/Button";
import { EXAMPLES_ORIGIN, ROUTES } from "@/lib/constants";

export function Hero({ shot }: { shot: ShotData }) {
  return (
    <section className="pb-16 pt-10 sm:pb-[4.5rem] sm:pt-12">
      <Container>
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-medium text-text-secondary">For incident reports, ADRs, RFCs and runbooks</p>
          <h1 className="mt-4 font-display text-display font-medium text-balance">
            Write it in Markdown. <Mark>Publish it as a page.</Mark>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-text-secondary">
            Booklet publishes an engineering document as a page with a link. The page shows the document&apos;s type and
            status, links to the documents it names, and can sit in a team space. Free, and you can try it without an
            account.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" size="xl" href={ROUTES.app}>
              Write a page
            </Button>
            <Button variant="secondary" size="xl" href={`${EXAMPLES_ORIGIN}/p/example-incident-report`}>
              Read a live incident report
            </Button>
          </div>
        </div>
        <div className="mt-10 sm:mt-12">
          <ProductShot data={shot} />
        </div>
      </Container>
    </section>
  );
}
