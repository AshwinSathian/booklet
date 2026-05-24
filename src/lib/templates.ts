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
  {
    slug: "product-spec",
    name: "Product Spec",
    description: "Define a feature — problem, goals, constraints, and non-goals.",
    category: "Product",
    headline: "Product Spec Template",
    metaDescription: "Write a clear product specification with problem statement, goals, constraints, and success metrics.",
    content: `# Product Spec: [Feature Name]

**Author:** [Your name]
**Status:** Draft | In Review | Approved
**Last updated:** [Date]

---

## Problem Statement

What user pain are we solving? Why does it matter now?

> [1–2 sentence summary of the problem]

---

## Goals

What does success look like? List outcomes, not outputs.

- Goal 1: [e.g., Reduce time to X by Y%]
- Goal 2:
- Goal 3:

## Non-Goals

Be explicit about what is out of scope for this version.

- We are not building [X]
- We are not targeting [audience segment]

---

## User Stories

| As a… | I want to… | So that… |
|-------|-----------|----------|
| [user type] | [action] | [outcome] |
| [user type] | [action] | [outcome] |

---

## Proposed Solution

High-level description of the approach. Link to design mocks if available.

### Key Flows

1. **Flow 1:** [description]
2. **Flow 2:** [description]

---

## Constraints & Risks

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| [e.g., Must use existing auth] | [Medium] | [Plan] |

---

## Success Metrics

How will we measure whether this worked?

| Metric | Baseline | Target | Timeframe |
|--------|---------|--------|-----------|
| [Metric name] | [Current] | [Goal] | [When] |

---

## Open Questions

- [ ] Question 1 — *Owner: @name*
- [ ] Question 2

---

## Timeline

| Milestone | Date |
|-----------|------|
| Design review | |
| Engineering kickoff | |
| Beta / internal launch | |
| GA | |
`,
  },
  {
    slug: "design-review",
    name: "Design Review",
    description: "Capture design decisions, feedback, and open questions from a review session.",
    category: "Design",
    content: `# Design Review: [Feature / Component Name]

**Date:** [Date]
**Designer:** [Name]
**Attendees:** [Names]
**Design link:** [Figma / link]

---

## Context

Why are we reviewing this design now? What decision do we need to make?

---

## Design Summary

What is the design trying to achieve? What constraints shaped it?

---

## Feedback

### Approved decisions

- ✅ [Decision 1]
- ✅ [Decision 2]

### Items to revisit

| Issue | Severity | Owner | Resolution |
|-------|---------|-------|------------|
| [Description] | High / Med / Low | @name | |

---

## Open Questions

- [ ] Question 1
- [ ] Question 2

---

## Next Steps

- [ ] [Action] — *Owner: @name, by [date]*
- [ ] [Action] — *Owner: @name, by [date]*
`,
  },
  {
    slug: "api-changelog",
    name: "API Changelog",
    description: "Communicate breaking changes, deprecations, and new endpoints to API consumers.",
    category: "Engineering",
    headline: "API Changelog Template",
    metaDescription: "Document API breaking changes, deprecations, and new endpoints clearly for your developers.",
    content: `# API Changelog

> **Subscribe to updates:** [Link to mailing list / Slack channel]

---

## [Version] — [Date]

### Breaking changes

> ⚠️ Action required by [date].

- **[Endpoint or field]:** [What changed and why.]
  *Migration:* [What callers must do.]

### Deprecated

- **[Endpoint or field]:** Deprecated, will be removed in [version/date].
  *Use instead:* [\`replacement\`](#)

### New

- **[Endpoint]:** [Brief description.] [Docs →](#)

### Fixed

- **[Bug description]** — [Impact and resolution.]

---

## [Previous version] — [Date]

*(Copy the block above for each release)*
`,
  },
  {
    slug: "technical-investigation",
    name: "Technical Investigation",
    description: "Document a debugging or research investigation — findings, hypotheses, and resolution.",
    category: "Engineering",
    headline: "Technical Investigation Template",
    metaDescription: "Structure a technical investigation with hypothesis, findings, and resolution for knowledge sharing.",
    content: `# Technical Investigation: [Topic]

**Author:** [Name]
**Date:** [Date]
**Status:** In progress | Resolved | Inconclusive

---

## Summary

One paragraph summary of what was investigated and what was found.

---

## Background

Why did we investigate this? What triggered the investigation?

---

## Hypotheses

| # | Hypothesis | Tested | Result |
|---|-----------|--------|--------|
| 1 | [Hypothesis] | Yes / No | [Outcome] |
| 2 | [Hypothesis] | | |

---

## Investigation Log

### [Date / Time] — [Investigator]

What was tried, what was observed.

\`\`\`bash
# Commands or queries used
\`\`\`

**Finding:** [What was learned]

---

## Root Cause

[Describe the root cause once identified, or mark as unknown.]

---

## Resolution

Steps taken to resolve the issue.

---

## Follow-up Actions

- [ ] [Action] — *Owner: @name*
- [ ] [Action] — *Owner: @name*

---

## References

- [Link to related issue, PR, or document]
`,
  },
  {
    slug: "sprint-retrospective",
    name: "Sprint Retrospective",
    description: "Capture what went well, what didn't, and what to change next sprint.",
    category: "Engineering",
    content: `# Sprint [Number] Retrospective

**Date:** [Date]
**Facilitator:** [Name]
**Team:** [Team name]
**Sprint period:** [Start] → [End]

---

## What went well ✅

- [Positive observation]
- [Positive observation]
- [Positive observation]

---

## What could be better 🔧

- [Friction point]
- [Friction point]
- [Friction point]

---

## Action items

| Action | Owner | By when |
|--------|-------|---------|
| [Action] | @name | [date] |
| [Action] | @name | [date] |

---

## Metrics

| Metric | This sprint | Last sprint | Trend |
|--------|------------|-------------|-------|
| Story points delivered | | | |
| Bugs filed | | | |
| Bugs closed | | | |

---

## Notes

[Any other discussion worth capturing]
`,
  },
  {
    slug: "job-description",
    name: "Job Description",
    description: "Write a clear, honest job description that attracts the right candidates.",
    category: "People",
    content: `# [Job Title] at [Company]

**Location:** [City, Country / Remote / Hybrid]
**Team:** [Team name]
**Reports to:** [Role]

---

## About us

[2–3 sentences about the company — mission, product, and stage.]

---

## About the role

[2–3 sentences on why this role exists and what impact it will have.]

---

## What you'll do

- [Responsibility 1]
- [Responsibility 2]
- [Responsibility 3]
- [Responsibility 4]
- [Responsibility 5]

---

## What we're looking for

**Must-have**
- [Requirement]
- [Requirement]
- [Requirement]

**Nice-to-have**
- [Requirement]
- [Requirement]

---

## What we offer

- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

---

## How to apply

[Description of the application process and link.]

*[Company] is an equal-opportunity employer. We welcome applicants of all backgrounds.*
`,
  },
  {
    slug: "interview-debrief",
    name: "Interview Debrief",
    description: "Structured debrief doc to capture interviewer feedback and reach a hiring decision.",
    category: "People",
    content: `# Interview Debrief: [Candidate Name]

**Role:** [Role title]
**Interview date:** [Date]
**Hiring manager:** [Name]

---

## Panel

| Interviewer | Area covered | Signal |
|-------------|-------------|--------|
| [Name] | [e.g., Technical screen] | Strong / Mixed / Weak |
| [Name] | [e.g., System design] | |
| [Name] | [e.g., Behavioral] | |

---

## Feedback by dimension

### Technical ability

[Summary of technical performance — include specific examples from the interview.]

**Signal:** Strong ✅ / Mixed ⚠️ / Weak ❌

---

### Problem solving & thinking

[How did the candidate approach ambiguity? Did they ask good questions?]

**Signal:** Strong ✅ / Mixed ⚠️ / Weak ❌

---

### Communication

[Was the candidate clear, concise, and able to explain complex ideas?]

**Signal:** Strong ✅ / Mixed ⚠️ / Weak ❌

---

### Culture / values fit

[Did the candidate's values and working style align with the team?]

**Signal:** Strong ✅ / Mixed ⚠️ / Weak ❌

---

## Strengths

- [Strength]
- [Strength]

## Concerns

- [Concern]
- [Concern]

---

## Decision

☐ Strong hire  ☐ Hire  ☐ No hire  ☐ Strong no hire

**Rationale:** [1–2 sentences]

---

## Next steps

- [ ] Send offer / rejection by [date]
- [ ] [Any follow-up action]
`,
  },
  {
    slug: "project-kickoff",
    name: "Project Kickoff",
    description: "Align a project team on goals, scope, roles, and delivery plan from day one.",
    category: "Project Management",
    headline: "Project Kickoff Template",
    metaDescription: "Align your team on project goals, scope, roles, and milestones with this kickoff template.",
    content: `# Project Kickoff: [Project Name]

**Date:** [Date]
**PM / DRI:** [Name]
**Status:** Planning | Active | On hold

---

## Problem & opportunity

What problem are we solving and why does it matter now?

---

## Goals & success criteria

| Goal | How we measure it | Target |
|------|------------------|--------|
| [Goal] | [Metric] | [Value] |
| [Goal] | [Metric] | [Value] |

## Non-goals

- [What is explicitly out of scope]

---

## Scope

### In scope

- [Feature / area]
- [Feature / area]

### Out of scope

- [Feature / area]
- [Feature / area]

---

## Team

| Role | Name | Responsibility |
|------|------|---------------|
| Project lead | [Name] | Overall delivery |
| Engineering | [Name] | [Area] |
| Design | [Name] | [Area] |
| [Other] | [Name] | [Area] |

---

## Milestones

| Milestone | Target date | Owner |
|-----------|------------|-------|
| Kickoff complete | [Date] | [Name] |
| Design approved | [Date] | [Name] |
| Engineering complete | [Date] | [Name] |
| Launch | [Date] | [Name] |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Risk] | H/M/L | H/M/L | [Plan] |

---

## Open questions

- [ ] [Question] — *Owner: @name*
- [ ] [Question] — *Owner: @name*
`,
  },
  {
    slug: "launch-checklist",
    name: "Launch Checklist",
    description: "Track every task before, during, and after a product or feature launch.",
    category: "Product",
    headline: "Launch Checklist Template",
    metaDescription: "Never miss a step with this comprehensive pre-launch, launch-day, and post-launch checklist template.",
    content: `# Launch Checklist: [Feature / Product Name]

**Launch date:** [Date]
**DRI:** [Name]
**Status:** Preparing | Ready | Launched

---

## Pre-launch

### Engineering
- [ ] Feature flag enabled in production
- [ ] Load / performance testing complete
- [ ] Rollback plan documented
- [ ] Monitoring and alerts configured
- [ ] Error logging verified

### Design
- [ ] Final designs approved
- [ ] Accessibility review complete
- [ ] Mobile / responsive tested

### Product
- [ ] User acceptance testing (UAT) complete
- [ ] Edge cases identified and handled
- [ ] Analytics events wired

### Legal / Compliance
- [ ] Privacy review complete
- [ ] Terms of service updated if needed

### Communications
- [ ] Internal announcement drafted
- [ ] External announcement / blog post ready
- [ ] Support team briefed
- [ ] Changelog entry written

---

## Launch day

- [ ] Deploy to production
- [ ] Verify core flows in production
- [ ] Enable for target audience
- [ ] Publish announcement
- [ ] Notify support team

---

## Post-launch (first 48h)

- [ ] Monitor error rates
- [ ] Review user feedback / support volume
- [ ] Check analytics for anomalies
- [ ] Gather initial user feedback

---

## Retrospective

*To be filled in 1 week post-launch.*

**What went well:**

**What could be improved:**

**Action items:**
`,
  },
  {
    slug: "data-dictionary",
    name: "Data Dictionary",
    description: "Document your data model — tables, fields, types, and business definitions.",
    category: "Engineering",
    content: `# Data Dictionary: [System / Domain Name]

**Last updated:** [Date]
**Owner:** [Name / Team]

---

## Overview

Brief description of the data model and how it relates to the system.

---

## Tables / Collections

### \`[table_name]\`

[Brief description of what this table stores and its business purpose.]

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| \`id\` | \`UUID\` | No | Primary key |
| \`created_at\` | \`TIMESTAMP\` | No | Record creation time (UTC) |
| \`updated_at\` | \`TIMESTAMP\` | No | Last update time (UTC) |
| \`[column]\` | \`[type]\` | Yes / No | [Description] |

**Indexes:** \`[column]\`, \`[column]\`
**Relations:** References \`[other_table]\` via \`[column]\`

---

### \`[table_name]\`

[Description]

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| \`id\` | | No | |
| | | | |

---

## Enums & Constants

### \`[enum_name]\`

| Value | Meaning |
|-------|---------|
| \`[VALUE]\` | [Description] |
| \`[VALUE]\` | [Description] |

---

## Deprecated Fields

| Field | Table | Deprecated in | Will be removed | Migration |
|-------|-------|--------------|----------------|-----------|
| \`[field]\` | \`[table]\` | [version/date] | [date] | [action] |
`,
  },
  {
    slug: "proposal",
    name: "Proposal",
    description: "A structured proposal for a new initiative, change, or investment.",
    category: "Business",
    content: `# Proposal: [Title]

**Author:** [Name]
**Date:** [Date]
**Status:** Draft | Under review | Approved | Rejected

---

## Summary

One paragraph describing what is being proposed and why.

---

## Background

What context does the reader need to evaluate this proposal? What has been tried before?

---

## Proposal

### What we're proposing

[Clear description of the proposal.]

### Why this approach

[Rationale. Why not other approaches?]

### What we're asking for

| Ask | Amount / resource |
|-----|-------------------|
| Budget | |
| Engineering time | |
| Design time | |
| Other | |

---

## Expected outcomes

| Outcome | How we'll measure it |
|---------|---------------------|
| [Outcome] | [Metric] |
| [Outcome] | [Metric] |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| [Risk] | H/M/L | H/M/L | [Plan] |

---

## Alternatives considered

1. **[Alternative A]:** [Why not chosen]
2. **[Alternative B]:** [Why not chosen]

---

## Timeline

| Phase | Duration | Description |
|-------|---------|-------------|
| [Phase] | [Weeks] | [What happens] |

---

## Decision

**Approved:** ☐ Yes ☐ No ☐ Conditional
**Notes:**
**Decision date:**
`,
  },
  {
    slug: "user-research-report",
    name: "User Research Report",
    description: "Summarize user research findings, insights, and recommended actions.",
    category: "Design",
    content: `# User Research Report: [Study Name]

**Researcher:** [Name]
**Date:** [Date]
**Methods:** [e.g., Interviews, Usability test, Survey]
**Participants:** [n=X, describe cohort briefly]

---

## Research Questions

1. [What were we trying to learn?]
2. [Question 2]
3. [Question 3]

---

## Methodology

Brief description of how the research was conducted. Link to discussion guide or screener if available.

---

## Key Findings

### Finding 1: [Title]

[Description with supporting data or quotes.]

> "[Representative quote from participant]"
> — [Participant descriptor, e.g., "Startup founder, 3 years experience"]

**Implication:** [What this means for the product or team]

---

### Finding 2: [Title]

[Description]

> "[Quote]"

**Implication:** [Implication]

---

### Finding 3: [Title]

[Description]

---

## Themes Summary

| Theme | Frequency | Severity |
|-------|----------|---------|
| [Theme] | [X of Y participants] | High / Med / Low |
| [Theme] | | |

---

## Recommendations

| Priority | Recommendation | Owner |
|----------|---------------|-------|
| P0 | [Action] | [Team] |
| P1 | [Action] | [Team] |
| P2 | [Action] | [Team] |

---

## Appendix

- [Link to raw notes]
- [Link to recordings]
- [Link to screener/guide]
`,
  },
];

