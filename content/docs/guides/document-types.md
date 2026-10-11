---
title: Document types
description: Mark a page as an incident, postmortem, ADR, RFC, runbook or release notes, and show its status, severity, date and owners above the text.
order: 5
---

A page becomes an engineering document when its frontmatter has a `type`. The type does two things: the page shows a header strip under its title, and a team space groups the page with others of the same type.

## The types

| `type` | Shown as | Grouped in a space under |
| --- | --- | --- |
| `incident` | Incident | Incidents |
| `postmortem` | Postmortem | Postmortems |
| `adr` | ADR | Decision log |
| `rfc` | RFC | RFCs |
| `runbook` | Runbook | Runbooks |
| `release-notes` | Release notes | Release notes |

## The header strip

```markdown
---
type: adr
status: Accepted
date: 2026-08-02
owners: [platform-team, "@dana"]
supersedes: ADR-007 Retry in the client
---

# ADR-012 Queue retries
```

The strip shows the type, then whichever of these the frontmatter sets:

- `status`: any short text, such as Proposed, Accepted or Resolved.
- `severity`: any short text, such as P1.
- `date`: a `YYYY-MM-DD` date is formatted; anything else is shown as written.
- `owners`: people or teams.
- `supersedes`: the title of the document this one replaces.

None of them is required, and none is checked against a list. [Frontmatter](/docs/reference/frontmatter) has the length limits.

## Starting points

The editor's templates and `booklet new` both start a document with this frontmatter filled in. So do the MCP prompts.

## In a team space

A space's home lists its pages by type. The decision log is in order of the first number in each title, so start titles with `ADR-012`; incidents are listed by date. See [Team spaces](/docs/guides/team-spaces).
