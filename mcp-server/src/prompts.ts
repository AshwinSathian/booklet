// MCP Prompts — pre-built Markdown templates agents can expand with arguments.
// Each prompt returns a ready-to-publish document so the agent only needs to
// fill in details, then call publish_page.

export const PROMPT_DEFINITIONS = [
  {
    name: "incident_report",
    description: "Structured incident report template for service outages and on-call post-mortems.",
    arguments: [
      { name: "title", description: "Short incident title (e.g. 'API latency spike')", required: true },
      { name: "severity", description: "P1 / P2 / P3 / P4", required: false },
      { name: "date", description: "Incident date (ISO format preferred)", required: false },
    ],
  },
  {
    name: "adr",
    description: "Architecture Decision Record (ADR) template following Michael Nygard's format.",
    arguments: [
      { name: "title", description: "Short decision title (e.g. 'Use PostgreSQL for sessions')", required: true },
      { name: "status", description: "Proposed / Accepted / Deprecated / Superseded", required: false },
    ],
  },
  {
    name: "release_notes",
    description: "Product or library release notes template.",
    arguments: [
      { name: "product", description: "Product or library name", required: true },
      { name: "version", description: "Version number (e.g. 2.4.0)", required: true },
      { name: "date", description: "Release date", required: false },
    ],
  },
  {
    name: "rfc",
    description: "Request for Comments document for proposing technical changes.",
    arguments: [
      { name: "title", description: "RFC title", required: true },
      { name: "author", description: "Author name or team", required: false },
    ],
  },
  {
    name: "runbook",
    description: "Operational runbook template for services and on-call procedures.",
    arguments: [
      { name: "service", description: "Service name", required: true },
      { name: "team", description: "Owning team or squad", required: false },
    ],
  },
] as const;

type PromptName = (typeof PROMPT_DEFINITIONS)[number]["name"];

function renderIncidentReport(args: Record<string, string>): string {
  const title = args["title"] ?? "Untitled Incident";
  const severity = args["severity"] ?? "P2";
  const date = args["date"] ?? new Date().toISOString().split("T")[0];
  return `# Incident Report: ${title}

**Severity:** ${severity}
**Date:** ${date}
**Status:** Draft

---

## Summary

<!-- One-paragraph description of what happened and its customer impact. -->

## Timeline

| Time (UTC) | Event |
|---|---|
| 00:00 | First alert fired |
| 00:05 | On-call acknowledged |
| 00:30 | Root cause identified |
| 01:00 | Fix deployed |
| 01:30 | Incident resolved |

## Root Cause

<!-- What was the technical root cause? Be specific. -->

## Impact

- **Duration:** X hours Y minutes
- **Affected users / requests:** ~N
- **Revenue impact:** $X (if known)
- **SLA breach:** Yes / No

## Resolution

<!-- What was done to resolve the incident? -->

## Action Items

| Action | Owner | Due date |
|---|---|---|
| Add monitoring for X | @owner | YYYY-MM-DD |
| Improve runbook for Y | @owner | YYYY-MM-DD |

## Lessons Learned

<!-- What went well? What could be improved? -->
`;
}

function renderAdr(args: Record<string, string>): string {
  const title = args["title"] ?? "Untitled Decision";
  const status = args["status"] ?? "Proposed";
  const date = new Date().toISOString().split("T")[0];
  return `# ADR: ${title}

**Status:** ${status}
**Date:** ${date}

---

## Context

<!-- What is the issue that motivates this decision? What forces are at play? -->

## Decision

<!-- What is the decision being made? State it in active voice: "We will..." -->

## Consequences

### Positive
-

### Negative
-

### Neutral
-

## Alternatives Considered

### Option A
- **Pros:**
- **Cons:**

### Option B
- **Pros:**
- **Cons:**
`;
}

function renderReleaseNotes(args: Record<string, string>): string {
  const product = args["product"] ?? "Product";
  const version = args["version"] ?? "1.0.0";
  const date = args["date"] ?? new Date().toISOString().split("T")[0];
  return `# ${product} ${version} — Release Notes

**Released:** ${date}

---

## What's New

-

## Improvements

-

## Bug Fixes

-

## Breaking Changes

> ⚠️ If there are no breaking changes, remove this section.

-

## Upgrade Guide

\`\`\`bash
# Example upgrade command
npm install ${product.toLowerCase().replace(/\s+/g, "-")}@${version}
\`\`\`

## Full Changelog

<!-- Link to CHANGELOG or diff -->
`;
}

function renderRfc(args: Record<string, string>): string {
  const title = args["title"] ?? "Untitled RFC";
  const author = args["author"] ?? "Author";
  const date = new Date().toISOString().split("T")[0];
  return `# RFC: ${title}

**Author:** ${author}
**Date:** ${date}
**Status:** Draft

---

## Motivation

<!-- Why is this change needed? What problem does it solve? -->

## Proposal

<!-- Describe the proposed solution in detail. Include code, diagrams, or examples where helpful. -->

## Design

<!-- Technical design — key decisions, data flow, API changes, etc. -->

## Drawbacks

<!-- What are the downsides or risks of this approach? -->

## Alternatives

<!-- What other approaches were considered and why were they rejected? -->

## Open Questions

- [ ] Question 1
- [ ] Question 2

## Implementation Plan

1. Phase 1: ...
2. Phase 2: ...
3. Phase 3: ...
`;
}

function renderRunbook(args: Record<string, string>): string {
  const service = args["service"] ?? "Service";
  const team = args["team"] ?? "Platform";
  const date = new Date().toISOString().split("T")[0];
  return `# ${service} — Runbook

**Owner:** ${team}
**Last updated:** ${date}

---

## Service Overview

<!-- What does this service do? What does it own? -->

## On-Call Contacts

| Role | Contact |
|---|---|
| Primary on-call | |
| Escalation | |
| Vendor support | |

## Key Links

- **Dashboard:** [Grafana](#)
- **Logs:** [Datadog / CloudWatch](#)
- **Alerts:** [PagerDuty / OpsGenie](#)
- **Source code:** [GitHub](#)

---

## Common Alerts & Runbook Steps

### Alert: High Error Rate

**Trigger:** Error rate > 5% for 5 minutes

**Steps:**
1. Check the error logs: \`kubectl logs -n prod deployment/${service.toLowerCase()}\`
2. Identify the error type
3. If DB connectivity: check connection pool and database health
4. If memory: restart pods and file a postmortem
5. Escalate if not resolved in 15 minutes

### Alert: High Latency

**Trigger:** P99 latency > 2s for 5 minutes

**Steps:**
1. Check upstream dependencies
2. Review recent deployments
3. Enable request throttling if needed

---

## Deployment

\`\`\`bash
# Deploy new version
./scripts/deploy.sh ${service.toLowerCase()} production
\`\`\`

## Rollback

\`\`\`bash
# Roll back to previous version
./scripts/rollback.sh ${service.toLowerCase()}
\`\`\`
`;
}

export function renderPrompt(name: string, args: Record<string, string>): string | null {
  switch (name as PromptName) {
    case "incident_report": return renderIncidentReport(args);
    case "adr": return renderAdr(args);
    case "release_notes": return renderReleaseNotes(args);
    case "rfc": return renderRfc(args);
    case "runbook": return renderRunbook(args);
    default: return null;
  }
}
