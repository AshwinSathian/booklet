// MCP prompts: the six engineering templates shared with the web editor and
// `booklet new` (booklet-api-client), with the title and frontmatter filled
// from the prompt's arguments. The model fills in the sections and publishes.
//
// Nothing here is specific to a service: a section says what belongs in it.
// A prompt that came with example thresholds, commands or contacts would
// have them published as if they were the user's own.

import { coreTemplateMarkdown, frontmatterBlock } from "booklet-api-client";

export const PROMPT_DEFINITIONS = [
  {
    name: "incident_report",
    description: "Incident report: summary, impact, timeline, root cause, follow-ups.",
    arguments: [
      { name: "title", description: "Short incident title, such as 'Checkout API errors, 18 July'", required: true },
      { name: "severity", description: "P1, P2, P3 or P4", required: false },
      { name: "date", description: "Date of the incident, as YYYY-MM-DD", required: false },
    ],
  },
  {
    name: "postmortem",
    description: "Blameless postmortem: impact, timeline, root cause, contributing factors, action items.",
    arguments: [
      { name: "title", description: "Title of the incident under review", required: true },
      { name: "severity", description: "P1, P2, P3 or P4", required: false },
      { name: "date", description: "Date of the incident, as YYYY-MM-DD", required: false },
    ],
  },
  {
    name: "adr",
    description: "Architecture decision record: context, decision, consequences, alternatives considered.",
    arguments: [
      { name: "title", description: "The decision, starting with its number: 'ADR-012 Queue retries'. A team space sorts its decision log by that number.", required: true },
      { name: "status", description: "Proposed, Accepted, Deprecated or Superseded", required: false },
    ],
  },
  {
    name: "rfc",
    description: "Request for comments: problem, proposal, alternatives, rollout, open questions.",
    arguments: [
      { name: "title", description: "What is proposed, such as 'Read replicas for reporting'", required: true },
      { name: "author", description: "Author or owning team", required: false },
    ],
  },
  {
    name: "runbook",
    description: "Runbook: when to use it, checks before you start, steps, how to verify, how to roll back.",
    arguments: [
      { name: "service", description: "The task or service the runbook is for, such as 'Database failover'", required: true },
      { name: "team", description: "Owning team", required: false },
    ],
  },
  {
    name: "release_notes",
    description: "Release notes: added, changed, fixed, upgrade notes.",
    arguments: [
      { name: "product", description: "Product or library name", required: true },
      { name: "version", description: "Version number, such as 2.4.0", required: true },
      { name: "date", description: "Release date, as YYYY-MM-DD", required: false },
    ],
  },
] as const;

type PromptName = (typeof PROMPT_DEFINITIONS)[number]["name"];

const today = () => new Date().toISOString().slice(0, 10);
const owners = (name: string | undefined) => (name ? [name] : []);

// Each opens with frontmatter: `type` puts the page in its group in a team
// space, and the other fields show in the page's header strip.
const RENDERERS: Record<PromptName, (args: Record<string, string>) => string> = {
  incident_report: (args) =>
    coreTemplateMarkdown(
      "incident",
      frontmatterBlock({ type: "incident", status: "Draft", severity: args["severity"] ?? "P2", date: args["date"] ?? today(), owners: [] }),
      args["title"] ?? "Incident: [short title]",
    ),
  postmortem: (args) =>
    coreTemplateMarkdown(
      "postmortem",
      frontmatterBlock({ type: "postmortem", status: "Draft", severity: args["severity"] ?? "P2", date: args["date"] ?? today(), owners: [] }),
      `Postmortem: ${args["title"] ?? "[incident title]"}`,
    ),
  adr: (args) =>
    coreTemplateMarkdown(
      "adr",
      frontmatterBlock({ type: "adr", status: args["status"] ?? "Proposed", date: today(), owners: [] }),
      args["title"] ?? "ADR-000 [decision title]",
    ),
  rfc: (args) =>
    coreTemplateMarkdown(
      "rfc",
      frontmatterBlock({ type: "rfc", status: "Draft", date: today(), owners: owners(args["author"]) }),
      `RFC: ${args["title"] ?? "[title]"}`,
    ),
  runbook: (args) =>
    coreTemplateMarkdown(
      "runbook",
      frontmatterBlock({ type: "runbook", status: "Current", date: today(), owners: owners(args["team"]) }),
      `Runbook: ${args["service"] ?? "[task]"}`,
    ),
  release_notes: (args) =>
    coreTemplateMarkdown(
      "release-notes",
      frontmatterBlock({ type: "release-notes", status: "Released", date: args["date"] ?? today(), owners: [] }),
      `${args["product"] ?? "[Product]"} ${args["version"] ?? "[version]"}`,
    ),
};

export function renderPrompt(name: string, args: Record<string, string>): string | null {
  return Object.hasOwn(RENDERERS, name) ? RENDERERS[name as PromptName](args) : null;
}
