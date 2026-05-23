export type Template = {
  name: string;
  description: string;
  content: string;
  // SEO landing page fields (optional — only templates with these get a /templates/* page)
  slug?: string;
  aliases?: string[];
  headline?: string;
  metaDescription?: string;
  category?: string;
  useCases?: string[];
};

export function getTemplateBySlug(slug: string): Template | undefined {
  return TEMPLATES.find((t) => t.slug === slug || t.aliases?.includes(slug));
}

export const TEMPLATES: Template[] = [
  {
    slug: "incident-report",
    name: "Incident Report",
    headline: "Free Incident Report Template",
    description: "P1/P2 post-mortem: severity, timeline, root cause, next steps",
    metaDescription:
      "Free incident report template. Write and share a clean post-incident report with your team. No account required.",
    category: "Engineering",
    useCases: ["SRE teams", "DevOps engineers", "Engineering managers", "On-call engineers"],
    content: `# Incident Report — [Service Name] [Date]

## Summary

**Severity:** P1 / P2
**Status:** Resolved / Ongoing
**Duration:** HH:MM – HH:MM UTC
**Impact:** Brief description of user-visible impact.

---

## Timeline

| Time (UTC) | Event |
|---|---|
| HH:MM | Incident detected by [monitoring / user report] |
| HH:MM | On-call engineer paged |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Incident resolved |

---

## Root Cause

Describe the underlying technical cause.

---

## What Went Well

- Point 1
- Point 2

## What Could Be Improved

- Point 1
- Point 2

---

## Action Items

| Action | Owner | Due |
|---|---|---|
| Item 1 | @owner | YYYY-MM-DD |
| Item 2 | @owner | YYYY-MM-DD |
`,
  },
  {
    slug: "architecture-decision-record",
    aliases: ["adr"],
    name: "Architecture Decision Record",
    headline: "Free Architecture Decision Record (ADR) Template",
    description: "ADR: status, context, decision, consequences",
    metaDescription:
      "Free ADR template. Capture and share significant architecture decisions with context, rationale, and consequences.",
    category: "Engineering",
    useCases: ["Staff engineers", "Tech leads", "Software architects", "Engineering teams"],
    content: `# ADR-NNN: [Decision Title]

**Status:** Proposed / Accepted / Deprecated / Superseded
**Date:** YYYY-MM-DD
**Deciders:** @name1, @name2

---

## Context

What is the issue we're facing? What forces are at play (technical, organisational, constraints)?

---

## Decision

What is the change we're making?

---

## Consequences

### Positive
- Benefit 1
- Benefit 2

### Negative / Trade-offs
- Trade-off 1
- Trade-off 2

### Risks
- Risk 1

---

## Alternatives Considered

**Option A — [name]:** Brief description. Rejected because…

**Option B — [name]:** Brief description. Rejected because…
`,
  },
  {
    slug: "release-notes",
    name: "Release Notes",
    headline: "Free Release Notes Template",
    description: "Version, highlights, changes, breaking changes",
    metaDescription:
      "Free release notes template. Write clear, structured release notes and share them with your users instantly.",
    category: "Product",
    useCases: ["Product teams", "Engineering teams", "Open source maintainers", "SaaS companies"],
    content: `# Release Notes — v[X.Y.Z]

**Released:** YYYY-MM-DD
**Milestone:** [Link to milestone or tracker]

---

## Highlights

One sentence about the most notable thing in this release.

---

## What's New

- **Feature name:** Description of the new capability.
- **Feature name:** Description of the new capability.

## Improvements

- Description of enhancement.
- Description of enhancement.

## Bug Fixes

- Fixed: description of the fix.
- Fixed: description of the fix.

---

## Breaking Changes

> ⚠️ These changes require action before upgrading.

- **Changed:** What changed and what you need to do.

---

## Upgrade Guide

Steps to upgrade from the previous version.

---

## Contributors

Thank you to everyone who contributed to this release.
`,
  },
  {
    slug: "readme",
    name: "README",
    headline: "Free README Template",
    description: "Project name, installation, usage, contributing, licence",
    metaDescription:
      "Free README template for open source projects. Write a clean, structured README and share it as a readable page.",
    category: "Engineering",
    useCases: ["Open source maintainers", "Software developers", "Engineering teams"],
    content: `# Project Name

> One sentence description of what this project does.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Features

- Feature 1
- Feature 2
- Feature 3

---

## Installation

\`\`\`bash
npm install project-name
\`\`\`

---

## Usage

\`\`\`typescript
import { thing } from 'project-name';

const result = thing({ option: 'value' });
\`\`\`

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| \`option\` | \`string\` | \`"default"\` | What it does |

---

## Contributing

1. Fork the repository
2. Create a feature branch: \`git checkout -b feature/my-feature\`
3. Commit your changes: \`git commit -m 'Add my feature'\`
4. Push to the branch: \`git push origin feature/my-feature\`
5. Open a pull request

---

## Licence

[MIT](LICENSE) © Your Name
`,
  },
  {
    slug: "meeting-notes",
    name: "Meeting Notes",
    headline: "Free Meeting Notes Template",
    description: "Attendees, agenda, decisions, action items with owners",
    metaDescription:
      "Free meeting notes template. Capture decisions and action items clearly. Share readable meeting notes with your team instantly.",
    category: "General",
    useCases: ["Teams", "Project managers", "Engineering leads", "Anyone running meetings"],
    content: `# Meeting Notes — [Meeting Name]

**Date:** YYYY-MM-DD
**Time:** HH:MM – HH:MM [Timezone]
**Location / Link:** Zoom / Slack Huddle / Room

**Attendees:** @name1, @name2, @name3
**Facilitator:** @name
**Note-taker:** @name

---

## Agenda

1. Topic 1
2. Topic 2
3. Topic 3

---

## Discussion

### Topic 1

Notes from the discussion.

### Topic 2

Notes from the discussion.

---

## Decisions

- Decision 1
- Decision 2

---

## Action Items

| # | Action | Owner | Due |
|---|---|---|---|
| 1 | Description | @owner | YYYY-MM-DD |
| 2 | Description | @owner | YYYY-MM-DD |

---

## Next Meeting

**Date:** YYYY-MM-DD
**Agenda items to carry forward:** Item 1, Item 2
`,
  },
  {
    slug: "onboarding-guide",
    name: "Onboarding Guide",
    headline: "Free Onboarding Guide Template",
    description: "Setup, prerequisites, first steps, key contacts",
    metaDescription:
      "Free onboarding guide template. Create a clear, shareable onboarding doc for new team members. No account required.",
    category: "General",
    useCases: ["Engineering teams", "Team leads", "HR and People", "Remote teams"],
    content: `# Onboarding Guide — [Team / Role / System]

Welcome! This guide covers everything you need to get up and running.

---

## Prerequisites

- Prerequisite 1 (e.g. access to tool X)
- Prerequisite 2 (e.g. invite to Slack workspace)
- Prerequisite 3

---

## Day 1: Environment Setup

### Step 1 — Install tools

\`\`\`bash
# Install dependencies
brew install tool-name
\`\`\`

### Step 2 — Clone the repo

\`\`\`bash
git clone https://github.com/org/repo.git
cd repo
npm install
\`\`\`

### Step 3 — Configure environment

Copy \`.env.example\` to \`.env.local\` and fill in the values (ask your buddy for secrets).

---

## Key Resources

| Resource | Link | Description |
|---|---|---|
| Docs | [Link] | Internal documentation |
| Runbooks | [Link] | Operational runbooks |
| Alerts | [Link] | Monitoring dashboard |

---

## Key Contacts

| Name | Role | How to reach |
|---|---|---|
| @name | Tech lead | Slack: @handle |
| @name | Product | Slack: @handle |

---

## First Week Goals

- [ ] Complete environment setup
- [ ] Review architecture overview
- [ ] Ship one small change

---

## Questions?

Post in **#team-channel** or ask **@buddy**.
`,
  },
  {
    slug: "runbook",
    name: "Runbook",
    headline: "Free Runbook Template",
    description: "Trigger, pre-conditions, steps, rollback, escalation",
    metaDescription:
      "Free runbook template for engineering teams. Document operational procedures clearly. Publish a shareable runbook in minutes.",
    category: "Engineering",
    useCases: ["SRE teams", "Platform engineers", "DevOps", "On-call engineers"],
    content: `# Runbook — [Procedure Name]

**Last updated:** YYYY-MM-DD
**Owner:** @team or @name
**Severity:** P1 / P2 / Routine

---

## Trigger / When to Use This

Describe the situation or alert that triggers this runbook.

---

## Pre-conditions

- [ ] Confirm condition 1
- [ ] Confirm condition 2 (e.g. you have the right access)

---

## Steps

### 1. Verify the issue

\`\`\`bash
# Check logs
kubectl logs -n namespace deployment/service --tail 100
\`\`\`

### 2. Mitigate

\`\`\`bash
# Apply the fix
kubectl rollout restart deployment/service -n namespace
\`\`\`

### 3. Verify resolution

Describe how to confirm the issue is resolved.

---

## Rollback

\`\`\`bash
# Revert the change
kubectl rollout undo deployment/service -n namespace
\`\`\`

---

## Escalation

If these steps do not resolve the issue:

1. Page **@on-call-engineer** via PagerDuty
2. Post in **#incidents** with the alert link and what you've tried

---

## Post-Incident

- [ ] File a post-mortem if P1/P2
- [ ] Update this runbook if steps were inaccurate
`,
  },
  {
    slug: "postmortem",
    name: "Postmortem",
    headline: "Free Blameless Postmortem Template",
    description: "Blameless postmortem: impact, timeline, root cause, contributing factors, action items",
    metaDescription:
      "Free blameless postmortem template. Write a clear, structured postmortem and share it with your team instantly. No account required.",
    category: "Engineering",
    useCases: ["SRE teams", "Engineering managers", "DevOps engineers", "On-call engineers"],
    content: `# Postmortem — [Service / Feature Name]

**Date:** YYYY-MM-DD
**Severity:** P1 / P2
**Duration:** HH:MM – HH:MM UTC
**Author(s):** @name1, @name2
**Status:** Draft / Final

---

## Summary

A brief, neutral description of what happened and its impact. (2–3 sentences, no blame.)

---

## Impact

- **Users affected:** ~N users / % of traffic
- **Services affected:** Service A, Service B
- **Revenue impact:** $X or "not quantified"
- **Duration:** X hours Y minutes

---

## Timeline

| Time (UTC) | Event |
|---|---|
| HH:MM | First alert / first user report |
| HH:MM | On-call engineer paged |
| HH:MM | Incident channel opened |
| HH:MM | Root cause identified |
| HH:MM | Mitigation applied |
| HH:MM | Service restored |
| HH:MM | Monitoring confirmed stable |

---

## Root Cause

Describe the primary technical cause. Be specific: which system, which change, which condition?

---

## Contributing Factors

- Factor 1 (e.g. missing test coverage for edge case)
- Factor 2 (e.g. monitoring gap)
- Factor 3 (e.g. deployment without feature flag)

---

## What Went Well

- Point 1 (e.g. fast detection via alert)
- Point 2 (e.g. clear runbook made mitigation fast)

---

## What Went Poorly

- Point 1 (e.g. alert threshold too high — delayed detection)
- Point 2 (e.g. no rollback path)

---

## Lessons Learned

- Lesson 1
- Lesson 2

---

## Action Items

| # | Action | Owner | Due |
|---|---|---|---|
| 1 | Corrective action | @owner | YYYY-MM-DD |
| 2 | Monitoring improvement | @owner | YYYY-MM-DD |
| 3 | Process improvement | @owner | YYYY-MM-DD |
`,
  },
  {
    slug: "weekly-update",
    name: "Weekly Update",
    headline: "Free Weekly Update Template",
    description: "Summary, progress, blockers, next week",
    metaDescription:
      "Free weekly update template. Write and share a clear team status update with progress, blockers, and next steps.",
    category: "General",
    useCases: ["Engineering teams", "Managers", "Individual contributors", "Remote teams"],
    content: `# Weekly Update — Week of [Date]

**Author:** @name
**Team:** [Team name]

---

## Summary

One to two sentences on the week's most important outcome.

---

## Progress This Week

- ✅ Completed: Description
- ✅ Completed: Description
- 🔄 In progress: Description (ETA: date)

---

## Metrics

| Metric | Last Week | This Week | Target |
|---|---|---|---|
| Metric 1 | 0 | 0 | 0 |
| Metric 2 | 0 | 0 | 0 |

---

## Blockers

- **Blocker:** Description. **Needs:** What help is needed from whom.

*(No blockers this week)* — delete if applicable

---

## Next Week

- [ ] Goal 1
- [ ] Goal 2
- [ ] Goal 3

---

## Shoutouts

> Thanks to @name for [reason].
`,
  },
];
