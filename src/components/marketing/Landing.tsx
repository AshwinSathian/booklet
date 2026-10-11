import { BeforeAfter } from "@/components/marketing/home/BeforeAfter";
import { Close } from "@/components/marketing/home/Close";
import { DocumentSystem } from "@/components/marketing/home/DocumentSystem";
import { Hero } from "@/components/marketing/home/Hero";
import { PublishAnywhere } from "@/components/marketing/home/PublishAnywhere";
import { TemplateShelf } from "@/components/marketing/home/TemplateShelf";
import { PageShell } from "@/components/marketing/primitives";
import { getShotData } from "@/components/marketing/shot-data";

/** The homepage: the product working, then the case for it, then the way in. */
export function Landing() {
  return (
    <PageShell>
      <Hero shot={getShotData()} />
      <BeforeAfter />
      <DocumentSystem />
      <PublishAnywhere />
      <TemplateShelf />
      <Close />
    </PageShell>
  );
}
