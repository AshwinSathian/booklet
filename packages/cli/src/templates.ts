// Starting points for `booklet new <template>`. Plain Markdown, meant to be
// edited: every placeholder is a line to replace.

const today = () => new Date().toISOString().slice(0, 10);

export const TEMPLATES: Record<string, { description: string; body: () => string }> = {
  incident: {
    description: "Incident report: impact, timeline, root cause, follow-ups",
    body: () => `# Incident: <short title>

**Date:** ${today()}
**Severity:** P2
**Status:** Resolved

## Summary

What happened, in two or three sentences.

## Impact

Who was affected, for how long, and how badly.

## Timeline

| Time (UTC) | Event |
|---|---|
| 00:00 | First alert |
| 00:00 | Mitigated |

## Root cause

What failed and why.

## What went well

-

## Follow-ups

- [ ] Action, owner, due date
`,
  },
  adr: {
    description: "Architecture decision record: context, decision, consequences",
    body: () => `# ADR-000: <decision title>

**Status:** Proposed
**Date:** ${today()}

## Context

The situation and the forces that make a decision necessary.

## Decision

What we will do.

## Consequences

What becomes easier, what becomes harder, and what we accept.

## Alternatives considered

- Option, and why it was not chosen
`,
  },
  rfc: {
    description: "Request for comments: problem, proposal, open questions",
    body: () => `# RFC: <title>

**Author:** <name>
**Status:** Draft
**Date:** ${today()}

## Problem

What is wrong today, and for whom.

## Proposal

What you want to change.

## Alternatives

What else was considered.

## Rollout

How this ships, and how it is rolled back.

## Open questions

-
`,
  },
  runbook: {
    description: "Runbook: when to use it, steps, verification, rollback",
    body: () => `# Runbook: <task>

**Owner:** <team>
**Last reviewed:** ${today()}

## When to use this

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
`,
  },
  "release-notes": {
    description: "Release notes: added, changed, fixed, upgrade notes",
    body: () => `# <Product> <version>

Released ${today()}.

## Added

-

## Changed

-

## Fixed

-

## Upgrade notes

Anything a user must do when upgrading.
`,
  },
};
