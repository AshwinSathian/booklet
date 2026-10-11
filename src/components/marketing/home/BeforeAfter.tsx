import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { Section } from "@/components/marketing/primitives";
import { DEFAULT_SETTINGS } from "@/lib/blocks";
import { parseToBlocks } from "@/lib/parse";

const SUMMARY = `## Checkout API errors, 18 July

**Severity:** P1 · **Status:** Resolved

| UTC   | Event                    |
| ----- | ------------------------ |
| 14:32 | Alert: error rate above 5% |
| 14:45 | Connection pool found exhausted |
| 15:01 | Pool size reverted, deploy rolled out |

Root cause: the deploy on 14 July cut \`pool_size\` from 50 to 5.
`;

/** The same summary twice: as it lands in a chat message, and as the page Booklet makes of it. */
export function BeforeAfter() {
  return (
    <Section
      eyebrow="The problem"
      title="Pasted Markdown arrives as raw syntax"
      lede="Paste a report into chat, email or a ticket and the reader gets pound signs, asterisks and a table made of pipes. Send a link instead and they get the document."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <figure className="flex flex-col">
          <figcaption className="mb-3 text-sm font-medium text-text-secondary">Pasted into a chat</figcaption>
          <div aria-hidden className="flex-1 rounded-xl border border-border-default bg-bg-soft p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-fill-3 text-sm font-semibold">S</span>
              <span className="text-sm font-semibold">Sam</span>
              <span className="text-xs text-text-muted">15:12</span>
            </div>
            <p className="mt-3 text-[15px]">Summary of today&apos;s incident:</p>
            <pre data-sample className="mt-2 whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.6] text-text-secondary">
              {SUMMARY}
            </pre>
          </div>
          <p className="sr-only">The summary as raw Markdown, with its syntax characters showing.</p>
        </figure>

        <figure className="flex flex-col">
          <figcaption className="mb-3 text-sm font-medium text-text-secondary">
            Sent as a <span className="rounded-sm bg-highlight px-1 text-on-highlight">Booklet link</span>
          </figcaption>
          <div data-sample inert className="flex-1 rounded-xl border border-border-strong bg-bg-elevated p-6 sm:p-7">
            <BlockRenderer blocks={parseToBlocks(SUMMARY)} settings={DEFAULT_SETTINGS} headingOffset={1} />
          </div>
          <p className="sr-only">The same summary as a formatted page, with a heading, a table and inline code.</p>
        </figure>
      </div>
    </Section>
  );
}
