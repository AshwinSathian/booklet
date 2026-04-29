export type Template = {
  name: string;
  description: string;
  content: string;
};

export const TEMPLATES: Template[] = [
  {
    name: "Incident Report",
    description: "P1/P2 post-mortem: severity, timeline, root cause, next steps",
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
    name: "Architecture Decision Record",
    description: "ADR: status, context, decision, consequences",
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
    name: "Release Notes",
    description: "Version, highlights, changes, breaking changes",
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
    name: "README",
    description: "Project name, installation, usage, contributing, licence",
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
    name: "Meeting Notes",
    description: "Attendees, agenda, decisions, action items with owners",
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
    name: "Onboarding Guide",
    description: "Setup, prerequisites, first steps, key contacts",
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
    name: "Runbook",
    description: "Trigger, pre-conditions, steps, rollback, escalation",
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
    name: "Weekly Update",
    description: "Summary, progress, blockers, next week",
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
