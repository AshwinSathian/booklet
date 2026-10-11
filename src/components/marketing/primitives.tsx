import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import type { ReactNode } from "react";

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

/** Header, main and footer: the frame of every marketing and docs page. */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-text-primary">
      <SiteHeader />
      <main id="main" className={cx("flex-1", className)}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-[72rem] px-5 sm:px-8", className)}>{children}</div>;
}

/** A small label above a heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">{children}</p>;
}

/** The highlighter, behind a few words of a heading. */
export function Mark({ children }: { children: ReactNode }) {
  return <span className="mark">{children}</span>;
}

/** A homepage or landing section: label, serif heading, optional lede, content. */
export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cx("border-t border-border-default py-16 sm:py-24", className)}>
      <Container>
        <div className="max-w-3xl">
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <h2 className="mt-3 font-display text-h2 font-medium text-balance">{title}</h2>
          {lede ? <p className="mt-5 max-w-2xl text-lg leading-relaxed text-text-secondary">{lede}</p> : null}
        </div>
        <div className="mt-12 sm:mt-14">{children}</div>
      </Container>
    </section>
  );
}

/** Title block of a plain page (pricing, about, legal, changelog). */
export function PageTitle({ eyebrow, title, lede }: { eyebrow?: string; title: ReactNode; lede?: ReactNode }) {
  return (
    <header className="max-w-3xl">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.025em] text-balance">
        {title}
      </h1>
      {lede ? <p className="mt-5 text-lg leading-relaxed text-text-secondary">{lede}</p> : null}
    </header>
  );
}

/** Running prose at a reading measure: about, trust, privacy, terms. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "prose-typeset max-w-[46rem] text-[1.0625rem] leading-[1.7] text-text-secondary",
        "[&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:text-text-primary",
        "[&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1.5 [&_strong]:text-text-primary",
        "[&_code]:rounded [&_code]:bg-bg-soft [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A whole prose page: shell, title block, then running text. About, Trust, Privacy, Terms. */
export function ProsePage({ eyebrow, title, lede, children }: { eyebrow?: string; title: ReactNode; lede?: ReactNode; children: ReactNode }) {
  return (
    <PageShell>
      <Container className="py-14 sm:py-20">
        <PageTitle eyebrow={eyebrow} title={title} lede={lede} />
        <Prose className="mt-10">{children}</Prose>
      </Container>
    </PageShell>
  );
}

/** A paper card with a hairline. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-xl border border-border-default bg-bg-elevated", className)}>{children}</div>;
}
