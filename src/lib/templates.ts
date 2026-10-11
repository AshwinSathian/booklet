import { CORE_TEMPLATES, type CoreTemplate, type DocType } from "booklet-api-client";

export type Template = {
  name: string;
  /** One line: the sections it has. Shown on the template's card. */
  description: string;
  content: string;
  /** Frontmatter for an engineering document type; other templates get a plain `status` and `date`. */
  doc?: { type: DocType; status: string; severity?: string };
  slug: string;
  aliases?: string[];
  /** For the template's own page and its search result: what the document is and what the template gives you. */
  metaDescription: string;
  /** Who writes this document, as a sentence. */
  audience?: string;
  category: "Engineering" | "Product" | "Team";
};

/**
 * A template as it goes into the editor: its content under a frontmatter
 * block. Published, the block becomes the page's header strip (type, status,
 * severity, date, owners), and `type` is what a team space groups by.
 */
export function templateMarkdown(template: Template, today = new Date().toISOString().slice(0, 10)): string {
  const lines = [...Object.entries(templateMeta(template, today)).map(([key, value]) => `${key}: ${String(value)}`), "owners: []"];
  return `---\n${lines.join("\n")}\n---\n\n${template.content.trimStart()}`;
}

/** The fields `templateMarkdown` writes, for showing the header strip a published page would have. */
export function templateMeta(template: Template, today = new Date().toISOString().slice(0, 10)): Record<string, unknown> {
  const { type, status = "Draft", severity } = template.doc ?? {};
  return { ...(type ? { type } : {}), status, ...(severity ? { severity } : {}), date: today };
}

export function getTemplateBySlug(slug: string): Template | undefined {
  return TEMPLATES.find((t) => t.slug === slug || t.aliases?.includes(slug));
}

// The six engineering templates are written once, in booklet-api-client, and
// shared with `booklet new` and the MCP prompts. This adds what a page on
// the site needs: an address, and a sentence for the search result.
const CORE_PAGES: Record<CoreTemplate["key"], Pick<Template, "slug" | "aliases" | "metaDescription" | "audience" | "category">> = {
  incident: {
    slug: "incident-report",
    category: "Engineering",
    metaDescription:
      "An incident report template in Markdown: summary, impact, a UTC timeline, root cause and follow-ups with owners. Opens in the editor; no account needed.",
    audience: "For the on-call engineer who ran the incident.",
  },
  postmortem: {
    slug: "postmortem",
    category: "Engineering",
    metaDescription:
      "A blameless postmortem template in Markdown: impact, timeline, root cause, contributing factors, what you would change, and action items with owners.",
    audience: "For whoever leads the review after an incident.",
  },
  adr: {
    slug: "architecture-decision-record",
    aliases: ["adr"],
    category: "Engineering",
    metaDescription:
      "An architecture decision record (ADR) template in Markdown: context, decision, consequences and the alternatives you rejected. Number the title and a team space keeps the log in order.",
    audience: "For the engineer or architect making the decision.",
  },
  rfc: {
    slug: "rfc",
    category: "Engineering",
    metaDescription:
      "An RFC template in Markdown: the problem, the proposal, alternatives, rollout and open questions. Publish it and send the link for comments.",
    audience: "For an engineer proposing a change that others have to agree to.",
  },
  runbook: {
    slug: "runbook",
    category: "Engineering",
    metaDescription:
      "A runbook template in Markdown: when to use it, checks before you start, numbered steps with commands, how to verify, how to roll back and who to call.",
    audience: "For the team that owns the service and is on call for it.",
  },
  "release-notes": {
    slug: "release-notes",
    category: "Engineering",
    metaDescription: "A release notes template in Markdown: what was added, changed and fixed, and what a user has to do when upgrading.",
    audience: "For whoever ships the release.",
  },
};

const CORE: Template[] = CORE_TEMPLATES.map((core) => ({
  name: core.name,
  description: core.description,
  doc: core.doc,
  content: `# ${core.title}\n\n${core.body}`,
  ...CORE_PAGES[core.key],
}));

const OTHERS: Template[] = [
  {
    slug: "technical-investigation",
    name: "Technical investigation",
    category: "Engineering",
    description: "Question, what was tried, findings, conclusion, what is still unknown",
    metaDescription:
      "A template for writing up a debugging or research investigation: the question, what you tried, what you found, the conclusion and what is still unknown.",
    audience: "For the engineer who did the digging.",
    content: `# Investigation: [the question]

## Question

What you set out to find, and why it matters now.

## What we know

The symptoms, with numbers, logs or graphs.

## What was tried

| Hypothesis | How it was tested | Result |
|---|---|---|
| | | |

## Findings

What the evidence shows.

## Conclusion

The answer, or the most likely one and how sure you are.

## Still unknown

- [ ] Question, and how to answer it
`,
  },
  {
    slug: "api-changelog",
    name: "API changelog",
    category: "Engineering",
    doc: { type: "release-notes", status: "Released" },
    description: "Breaking changes, deprecations, additions, fixes, with dates",
    metaDescription:
      "An API changelog template in Markdown: breaking changes with what to do about them, deprecations with removal dates, additions and fixes.",
    audience: "For the team that maintains an API other people call.",
    content: `# [API name] changelog: [version or date]

## Breaking changes

| Change | What breaks | What to do |
|---|---|---|
| | | |

## Deprecated

| Endpoint or field | Use instead | Removed on |
|---|---|---|
| | | |

## Added

-

## Fixed

-
`,
  },
  {
    slug: "readme",
    name: "README",
    category: "Engineering",
    description: "What it is, install, usage, configuration, contributing, licence",
    metaDescription: "A README template in Markdown: what the project is, how to install and use it, configuration, how to contribute and the licence.",
    audience: "For the maintainer of a library or service.",
    content: `# [Project name]

One sentence: what it does and who it is for.

## Install

\`\`\`bash
command --here
\`\`\`

## Usage

The smallest example that does something useful.

\`\`\`bash
command --here
\`\`\`

## Configuration

| Setting | Default | What it does |
|---|---|---|
| | | |

## Contributing

How to run the tests, and what a pull request needs.

## Licence

The licence, and a link to its text.
`,
  },
  {
    slug: "data-dictionary",
    name: "Data dictionary",
    category: "Engineering",
    description: "Tables, fields, types, meaning, where the data comes from",
    metaDescription: "A data dictionary template in Markdown: each table with its fields, types, meaning, and where the data comes from.",
    audience: "For the team that owns a database or a data pipeline.",
    content: `# Data dictionary: [system]

## [table_name]

What one row is.

| Field | Type | Meaning | Source |
|---|---|---|---|
| | | | |

## Relationships

Which tables point at which, and through what key.

## Notes

Anything that surprises people: units, time zones, values that mean "unknown".
`,
  },
  {
    slug: "onboarding-guide",
    name: "Onboarding guide",
    category: "Engineering",
    description: "Access, setup, the first week, who to ask",
    metaDescription: "An onboarding guide template in Markdown: the access a new engineer needs, how to set up, what to do in the first week and who to ask.",
    audience: "For the person who onboards a new teammate.",
    content: `# Onboarding: [team]

What to set up in your first week, and who to ask.

## Access

- [ ] Account or tool, and who grants it

## Set up

1. First step

   \`\`\`bash
   command --here
   \`\`\`

2. Second step

## First week

- [ ] A first change to ship
- [ ] A document to read
- [ ] A person to meet

## Who to ask

| About | Ask |
|---|---|
| | |
`,
  },
  {
    slug: "sprint-retrospective",
    name: "Sprint retrospective",
    category: "Engineering",
    description: "What went well, what did not, what to change, action items",
    metaDescription: "A sprint retrospective template in Markdown: what went well, what did not, what to change next sprint, and action items with owners.",
    audience: "For whoever runs the retrospective.",
    content: `# Retrospective: [sprint]

## What went well

-

## What did not

-

## What we will change

-

## Action items

| Action | Owner | Due |
|---|---|---|
| | | |
`,
  },
  {
    slug: "product-spec",
    name: "Product spec",
    category: "Product",
    description: "Problem, goals, non-goals, requirements, open questions",
    metaDescription: "A product spec template in Markdown: the problem, goals and non-goals, requirements, how success is measured and open questions.",
    audience: "For the product manager or engineer defining a feature.",
    content: `# [Feature name]

## Problem

Who has it, how often, and what they do about it today.

## Goals

- What will be true when this ships

## Non-goals

- What this deliberately leaves out

## Requirements

| Requirement | Must or should | Notes |
|---|---|---|
| | | |

## Measuring success

The number that should move, and by how much.

## Open questions

- [ ] Question, and who can answer it
`,
  },
  {
    slug: "launch-checklist",
    name: "Launch checklist",
    category: "Product",
    description: "Before, on the day and after, with an owner for each task",
    metaDescription: "A launch checklist template in Markdown: the tasks before, on the day and after a launch, each with an owner.",
    audience: "For whoever is responsible for the launch.",
    content: `# Launch: [name]

Launch date: [date]

## Before

- [ ] Task, owner

## On the day

- [ ] Task, owner

## After

- [ ] Task, owner

## Rolling back

What "this is not working" looks like, and what to do then.
`,
  },
  {
    slug: "proposal",
    name: "Proposal",
    category: "Product",
    description: "Summary, the case for it, the plan, cost, risks, the decision asked for",
    metaDescription: "A proposal template in Markdown: a summary, the case for the change, the plan, what it costs, the risks and the decision you are asking for.",
    audience: "For anyone asking for a decision or a budget.",
    content: `# Proposal: [title]

## Summary

What you are asking for, in two or three sentences.

## Why

The problem, and what it costs to leave it.

## Plan

What would be done, in what order, and by whom.

## Cost

Time, money and what will not get done instead.

## Risks

| Risk | How likely | What we would do |
|---|---|---|
| | | |

## Decision needed

What you need decided, by whom, and by when.
`,
  },
  {
    slug: "project-kickoff",
    name: "Project kickoff",
    category: "Team",
    description: "Goal, scope, who does what, milestones, risks",
    metaDescription: "A project kickoff template in Markdown: the goal, what is in and out of scope, who does what, milestones and risks.",
    audience: "For the person leading the project.",
    content: `# Kickoff: [project]

## Goal

What will be true when the project is done.

## Scope

In:

-

Out:

-

## People

| Person | Role |
|---|---|
| | |

## Milestones

| Milestone | Date |
|---|---|
| | |

## Risks

-
`,
  },
  {
    slug: "meeting-notes",
    name: "Meeting notes",
    category: "Team",
    description: "Who was there, decisions, action items with owners",
    metaDescription: "A meeting notes template in Markdown: who was there, what was decided, and action items with an owner and a date.",
    audience: "For whoever is taking notes.",
    content: `# [Meeting], [date]

Present: [names]

## Decisions

-

## Discussion

What was said that someone who missed the meeting needs to know.

## Action items

| Action | Owner | Due |
|---|---|---|
| | | |
`,
  },
  {
    slug: "weekly-update",
    name: "Weekly update",
    category: "Team",
    description: "What shipped, what is in progress, what is blocked, next week",
    metaDescription: "A weekly update template in Markdown: what shipped, what is in progress, what is blocked and what comes next week.",
    audience: "For a team lead writing to the people who depend on the team.",
    content: `# Week of [date]

## Shipped

-

## In progress

-

## Blocked

What is stuck, and what would unblock it. Delete this section if there is nothing.

## Next week

-
`,
  },
  {
    slug: "design-review",
    name: "Design review",
    category: "Team",
    description: "What was reviewed, feedback, decisions, open questions",
    metaDescription: "A design review template in Markdown: what was reviewed, the feedback, what was decided and what is still open.",
    audience: "For the designer or engineer whose work was reviewed.",
    content: `# Design review: [what was reviewed]

Reviewers: [names]

## What was reviewed

A link to the design, and the question the review was meant to answer.

## Feedback

| Point | Raised by | Response |
|---|---|---|
| | | |

## Decisions

-

## Open questions

- [ ] Question, and who can answer it
`,
  },
  {
    slug: "user-research-report",
    name: "User research report",
    category: "Team",
    description: "Question, method, who took part, findings, recommendations",
    metaDescription: "A user research report template in Markdown: the question, the method, who took part, findings with evidence, and recommendations.",
    audience: "For the researcher or product manager who ran the study.",
    content: `# Research: [the question]

## Question

What the study set out to learn.

## Method

How it was done, and with how many people. Describe participants by role, not by name.

## Findings

1. Finding, and the evidence for it

## Recommendations

| Recommendation | Based on finding |
|---|---|
| | |

## Limits

What this study cannot tell you.
`,
  },
  {
    slug: "job-description",
    name: "Job description",
    category: "Team",
    description: "The role, what the person will do, what they need, how to apply",
    metaDescription: "A job description template in Markdown: the role and team, what the person will do, what they need to have, pay and location, and how to apply.",
    audience: "For the hiring manager.",
    content: `# [Job title]

Location: [place or remote] · Team: [team] · Pay: [range]

## The role

What the team does, and what this person is being hired to do.

## What you will do

-

## What you need

-

## Good to have

-

## How to apply

Where to send what, and what happens after.
`,
  },
  {
    slug: "interview-debrief",
    name: "Interview debrief",
    category: "Team",
    description: "Panel, feedback by area, strengths, concerns, decision",
    metaDescription: "An interview debrief template in Markdown: the panel, feedback by area, strengths, concerns and the decision. Publish it to your team only.",
    audience: "For the hiring manager running the debrief.",
    content: `# Interview debrief: [role]

> [!IMPORTANT]
> This page is about a person. Publish it into a team space as Team only, or give it a password. Use the candidate's initials, not their name.

Panel: [names]

## Feedback by area

| Area | Interviewer | Notes |
|---|---|---|
| | | |

## Strengths

-

## Concerns

-

## Decision

Hire, no hire, or what is still needed to decide.
`,
  },
];

export const TEMPLATES: Template[] = [...CORE, ...OTHERS];
