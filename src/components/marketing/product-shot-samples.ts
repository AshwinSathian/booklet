/**
 * The four documents the homepage plays: Markdown on the left, the page on
 * the right. Written out by hand as finished documents, the way a team
 * would write them. The frontmatter drives the header strip. Each is
 * published on the live site at its \`url\`, so the address the frame ends
 * on is a real page with this content.
 */
export type ShotSample = {
  id: "incident" | "adr" | "rfc" | "runbook";
  label: string;
  file: string;
  /** Shown in the frame's address bar once the page is "published". */
  url: string;
  source: string;
};

export const SHOT_SAMPLES: ShotSample[] = [
  {
    id: "incident",
    label: "Incident",
    file: "incident.md",
    url: "booklet.ashwinsathian.com/p/checkout-incident-07-18",
    source: `---
type: incident
status: Resolved
severity: P1
date: 2026-07-18
owners: [payments-oncall]
---

# Checkout API errors, 18 July

About 8% of checkout requests failed for 32 minutes.
No payment was taken twice.

## Timeline

| UTC   | Event                                  |
| ----- | -------------------------------------- |
| 14:32 | Alert: error rate above 5%             |
| 14:45 | Connection pool found exhausted        |
| 15:01 | Pool size reverted, deploy rolled out  |
| 15:04 | Error rate back to normal              |

## Root cause

The deploy on 14 July cut the pool from 50 connections to 5.

\`\`\`yaml
pool_size: 5 # was 50
\`\`\`

> [!WARNING]
> The same value is still set in staging.
`,
  },
  {
    id: "adr",
    label: "ADR",
    file: "adr-012.md",
    url: "booklet.ashwinsathian.com/p/adr-012-queue-retries",
    source: `---
type: adr
status: Accepted
date: 2026-08-03
owners: [platform-team]
supersedes: ADR-007 Retry in the client
---

# ADR-012 Queue retries

## Context

A failed job is retried by whoever called it. Three
callers do it three ways, and one has no limit: see
[Delayed payouts, 2 June](/p/delayed-payouts-06-02).

## Decision

The queue retries. Callers do not.

- Five attempts, with exponential backoff and jitter
- A job that fails five times goes to a dead-letter queue
- An alert fires when that queue is not empty

## Consequences

Callers get simpler. A poison message now stops after
five attempts instead of looping for hours.

| Attempt | Waits about |
| ------- | ----------- |
| 2       | 2 s         |
| 3       | 8 s         |
| 5       | 2 min       |
`,
  },
  {
    id: "rfc",
    label: "RFC",
    file: "rfc-read-replicas.md",
    url: "booklet.ashwinsathian.com/p/rfc-read-replicas",
    source: `---
type: rfc
status: In review
date: 2026-09-09
owners: ["@dana", "@lee"]
---

# RFC: Read replicas for reporting

## Problem

Month-end reports run on the primary and slow down
checkout for about an hour.

## Proposal

Send reporting queries to a read replica.

1. Add one replica in the same region
2. Route the reporting service to it
3. Accept up to 30 seconds of lag in reports

## Open questions

- [x] Does the ORM support a second connection?
- [ ] Who is paged when the replica falls behind?

> [!NOTE]
> Comments close on 23 September.
`,
  },
  {
    id: "runbook",
    label: "Runbook",
    file: "runbook-failover.md",
    url: "booklet.ashwinsathian.com/p/runbook-db-failover",
    source: `---
type: runbook
status: Current
date: 2026-06-30
owners: [database-team]
---

# Runbook: Database failover

Use this when the primary is down or unreachable for
more than two minutes.

## Before you start

- You are the incident commander, or they asked you to
- Replica lag is under 10 seconds

## Steps

1. Stop writes at the load balancer

\`\`\`bash
lbctl drain payments-primary --wait
\`\`\`

2. Promote the replica

\`\`\`bash
dbctl promote payments-replica-1
\`\`\`

3. Point the service at the new primary and resume

## If it goes wrong

> [!CAUTION]
> Never promote while lag is above 10 seconds.
`,
  },
];
