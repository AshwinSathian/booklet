// The six engineering templates, written once. The web editor, `booklet new`
// and the MCP prompts all start a document from these, so the same type
// gets the same sections whichever way it is started.
//
// A body is plain Markdown with no frontmatter: each caller adds its own
// (the date, and whatever its arguments supply). A line in [square
// brackets] is to be replaced; a sentence under a heading says what goes
// there and is to be replaced too.

import type { DocType } from "./schemas.js";

export type CoreTemplate = {
  /** The name `booklet new` takes. */
  key: "incident" | "postmortem" | "adr" | "rfc" | "runbook" | "release-notes";
  name: string;
  /** One line: the sections it has. */
  description: string;
  doc: { type: DocType; status: string; severity?: string };
  /** The `# ` line. Callers may replace it with one built from arguments. */
  title: string;
  /** Everything under the title. */
  body: string;
};

export const CORE_TEMPLATES: CoreTemplate[] = [
  {
    key: "incident",
    name: "Incident report",
    description: "Summary, impact, timeline, root cause, follow-ups",
    doc: { type: "incident", status: "Resolved", severity: "P2" },
    title: "Incident: [short title]",
    body: `## Summary

What happened, in two or three sentences.

## Impact

Who was affected, for how long, and how badly. Give numbers where you have them.

## Timeline

| Time (UTC) | Event |
|---|---|
| 00:00 | First alert |
| 00:00 | Mitigated |
| 00:00 | Resolved |

## Root cause

What failed and why.

## Follow-ups

- [ ] Action, owner, due date
`,
  },
  {
    key: "postmortem",
    name: "Postmortem",
    description: "Impact, timeline, root cause, contributing factors, what we learned, action items",
    doc: { type: "postmortem", status: "Draft", severity: "P2" },
    title: "Postmortem: [incident title]",
    body: `This review is blameless: it describes what the system and the process allowed, not who made a mistake.

## Impact

Who was affected, for how long, and how badly. Give numbers where you have them.

## Timeline

| Time (UTC) | Event |
|---|---|
| 00:00 | Change that started it |
| 00:00 | Detected, and how |
| 00:00 | Mitigated |
| 00:00 | Resolved |

## Root cause

What failed and why.

## Contributing factors

What made it more likely, harder to notice or slower to fix.

## What went well

-

## What we would change

-

## Action items

| Action | Owner | Due |
|---|---|---|
| | | |
`,
  },
  {
    key: "adr",
    name: "Architecture decision record",
    description: "Context, decision, consequences, alternatives considered",
    doc: { type: "adr", status: "Proposed" },
    title: "ADR-000 [decision title]",
    body: `## Context

The situation and the forces that make a decision necessary.

## Decision

What we will do.

## Consequences

What becomes easier, what becomes harder, and what we accept.

## Alternatives considered

- Option, and why it was not chosen
`,
  },
  {
    key: "rfc",
    name: "RFC",
    description: "Problem, proposal, alternatives, rollout, open questions",
    doc: { type: "rfc", status: "Draft" },
    title: "RFC: [title]",
    body: `## Problem

What is wrong today, and for whom.

## Proposal

What you want to change.

## Alternatives

What else was considered, and why not.

## Rollout

How this ships, and how it is rolled back.

## Open questions

- [ ] Question, and who can answer it
`,
  },
  {
    key: "runbook",
    name: "Runbook",
    description: "When to use it, checks before you start, steps, how to verify, how to roll back",
    doc: { type: "runbook", status: "Current" },
    title: "Runbook: [task]",
    body: `## When to use this

The alert or request that leads here.

## Before you start

- Access you need
- Things to check first

## Steps

1. First step

   \`\`\`bash
   command --here
   \`\`\`

2. Second step

## Verify

How to tell it worked.

## Roll back

How to undo it.

## Escalate

Who to call if this does not work, and after how long.
`,
  },
  {
    key: "release-notes",
    name: "Release notes",
    description: "Added, changed, fixed, upgrade notes",
    doc: { type: "release-notes", status: "Released" },
    title: "[Product] [version]",
    body: `## Added

-

## Changed

-

## Fixed

-

## Upgrade notes

Anything a user must do when upgrading. Say so if there is nothing.
`,
  },
];

export function coreTemplate(key: CoreTemplate["key"]): CoreTemplate {
  const found = CORE_TEMPLATES.find((t) => t.key === key);
  if (!found) throw new Error(`No core template "${key}"`);
  return found;
}

/** A core template as Markdown, under whatever frontmatter block the caller built. `title` replaces the placeholder title. */
export function coreTemplateMarkdown(key: CoreTemplate["key"], frontmatter: string, title?: string): string {
  const template = coreTemplate(key);
  return `${frontmatter}# ${title ?? template.title}\n\n${template.body}`;
}
