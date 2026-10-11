"use client";

import { CopyButton } from "@/components/marketing/CopyButton";
import { Section } from "@/components/marketing/primitives";
import Link from "next/link";
import { onTablistKeyDown } from "@/lib/ui/tablist";
import { useState } from "react";

const WAYS = [
  {
    id: "editor",
    label: "Editor",
    text: "Write in the browser with the page beside you as you type. Publish with one key press. No account needed to try it.",
    file: "Keyboard",
    code: "⌘ ↵     Publish\n⌘ K     Commands and drafts\n[[      Link to another document",
    href: "/app",
    link: "Open the editor",
  },
  {
    id: "cli",
    label: "CLI",
    text: "Publish a file from a terminal or a script, and update the same page later. JSON output and fixed exit codes for scripts.",
    file: "Terminal",
    code: "export BOOKLET_API_KEY=bklt_your_key\nnpx booklet-cli publish runbook.md --space payments\nnpx booklet-cli publish runbook.md --update Ab3k91QxZp",
    href: "/docs/guides/cli",
    link: "CLI guide",
  },
  {
    id: "api",
    label: "API",
    text: "One POST with the Markdown publishes a page. Send an Idempotency-Key and a retried request does not publish it twice.",
    file: "HTTP",
    code: 'curl -X POST https://booklet.ashwinsathian.com/api/v1/publish \\\n  -H "Authorization: Bearer $BOOKLET_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"raw": "# Release notes\\n\\n..."}\'',
    href: "/docs/reference/api",
    link: "API reference",
  },
  {
    id: "action",
    label: "GitHub",
    text: "Publish release notes when a release is published, or a runbook when it changes on the main branch. The link stays the same.",
    file: ".github/workflows/runbook.yml",
    code: 'on:\n  push:\n    branches: [main]\n    paths: [docs/runbook.md]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npx booklet-cli publish docs/runbook.md --update "$PAGE_ID"\n        env:\n          BOOKLET_API_KEY: ${{ secrets.BOOKLET_API_KEY }}\n          PAGE_ID: ${{ vars.RUNBOOK_PAGE_ID }}',
    href: "/docs/guides/github-action",
    link: "GitHub guide",
  },
  {
    id: "mcp",
    label: "Claude and MCP",
    text: "Connect Claude, Cursor or another MCP client, hand it the timeline, and ask for the incident report to be published.",
    file: "MCP server",
    code: "https://booklet-mcp.ashwinsathian.com/mcp",
    href: "/docs/guides/mcp",
    link: "MCP setup",
  },
] as const;

/** Five ways to publish, one at a time. Every tab ends on the same kind of page. */
export function PublishAnywhere() {
  const [active, setActive] = useState(0);
  const way = WAYS[active];
  return (
    <Section
      eyebrow="Five ways in"
      title="Publish from where the document already is."
      lede="The editor, a terminal, a workflow, an HTTP request or a conversation with Claude. Each one makes the same page."
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <div>
          <div role="tablist" aria-label="Ways to publish" onKeyDown={onTablistKeyDown} className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0">
            {WAYS.map((w, i) => (
              <button
                key={w.id}
                type="button"
                role="tab"
                id={`way-tab-${w.id}`}
                aria-selected={i === active}
                tabIndex={i === active ? 0 : -1}
                aria-controls="way-panel"
                onClick={() => setActive(i)}
                className={
                  i === active
                    ? "rounded-lg bg-accent px-3.5 py-2 text-left text-sm font-semibold text-accent-contrast lg:rounded-none lg:border-l-2 lg:border-accent lg:bg-transparent lg:py-2.5 lg:pl-4 lg:text-lg lg:text-text-primary"
                    : "rounded-lg border border-border-strong px-3.5 py-2 text-left text-sm font-medium text-text-secondary hover:text-text-primary lg:rounded-none lg:border-0 lg:border-l-2 lg:border-border-default lg:py-2.5 lg:pl-4 lg:text-lg"
                }
              >
                {w.label}
              </button>
            ))}
          </div>
          <p className="mt-6 text-[1.0625rem] leading-relaxed text-text-secondary">{way.text}</p>
          <Link href={way.href} className="mt-4 inline-block text-sm font-semibold underline decoration-highlight decoration-[3px] underline-offset-[5px] hover:decoration-accent">
            {way.link}
          </Link>
        </div>

        <div id="way-panel" role="tabpanel" aria-labelledby={`way-tab-${way.id}`} className="min-w-0 overflow-hidden rounded-xl border border-border-strong bg-bg-elevated">
          <div className="flex h-11 items-center justify-between border-b border-border-default px-4">
            <span className="font-mono text-xs text-text-muted">{way.file}</span>
            <CopyButton text={way.code} />
          </div>
          <pre tabIndex={0} className="min-h-[13rem] overflow-x-auto p-5 font-mono text-[13px] leading-[1.7] text-text-primary">
            {way.code}
          </pre>
        </div>
      </div>
    </Section>
  );
}
