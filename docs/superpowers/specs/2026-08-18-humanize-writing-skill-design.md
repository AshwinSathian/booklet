# Humanize-Writing Skill — Design Spec

Date: 2026-08-18
Status: Approved for implementation

## 1. Goal

Build a Claude Code skill, `humanize-writing`, that changes how Claude writes
any time it produces text — so that output does not read as recognizably
AI-generated (no stock "AI tells": em-dash overuse, "delve/boast/testament",
rule-of-three constructions, stock transitions, hedge-heavy phrasing, uniform
sentence rhythm, listicle-itis, title-case headers, etc.), while remaining
accurate and well-organized.

The skill must be grounded in actual research (not folk wisdom), be
adversarially reviewed against that research and against current
skill-authoring best practice, installed locally, and published as a
standalone, well-structured public GitHub repo others can install.

## 2. Non-goals

- Not a plagiarism/AI-detector-evasion tool for academic dishonesty or fraud.
  The framing is "write well, in a natural human register" — not "defeat
  detector X." We will not tailor guidance to specific commercial detectors.
- Not scoped to a single content type (blog vs. email vs. code comment) —
  the trigger is broad ("everything Claude writes," per prior decision), but
  the guidance itself should degrade gracefully: prose-heavy advice
  (rhythm, transitions, hedging) applies most to prose; for code
  comments/commit messages the skill mainly suppresses the same tics where
  they'd otherwise leak in (e.g., "Additionally, this function...").
- Not a rewrite of existing skills (frontend-design, internal-comms, etc.) —
  it composes alongside them.
- Not full TDD-style pressure-testing (that toolkit targets discipline rules
  an agent might skip under pressure; this is a technique/reference skill).

## 3. Research plan

Dispatch parallel research agents (background, `general-purpose`), each with
a self-contained brief, each returning a structured written report (sources +
findings, not just a summary) saved to
`humanize-writing-skill/reference/research/<angle>.md` in the new repo's
working tree (created ahead of time so agents can write directly into it):

1. **Academic/computational** — stylometry and AI-text-detection research:
   perplexity/burstiness, watermarking studies, linguistic-marker papers
   (e.g. work on GPT-output distinguishing features), what actually
   correlates with "reads as AI" vs. what's folk myth.
2. **Editorial/practitioner guides** — Wikipedia's "Signs of AI writing"
   essay (WP:AICLEANUP), journalism/editing critiques of LLM prose,
   established prose style guides (Strunk & White-adjacent, Orwell's
   "Politics and the English Language," Hemingway-app-style guidance) on
   what makes writing read as human in the first place — not just tell
   removal but active craft (specificity, rhythm, voice).
3. **Tell catalogs, cross-referenced for consensus** — build a single
   ranked list of concrete AI-writing tells, each backed by 2+ independent
   well-rated sources (not one blogger's pet peeve), with the mechanism
   *why* each tell reads as artificial.
4. **Existing OSS humanizer skills/prompts** — GitHub repos, agent skill
   marketplaces (agentskills.io), Claude/GPT prompt libraries branded
   "humanize," "sound human," "AI detector bypass," etc. Catalog what each
   does well and poorly: specificity of guidance, over-reliance on banned
   word-lists (brittle), whether they address rhythm/structure or only
   vocabulary, whether they contradict good writing practice, whether
   they're maintained/credible (stars, recency, author reputation).

Each agent report must cite its sources (title + publisher/author + why it's
credible) so the synthesis step can weigh consensus vs. outlier claims.

## 4. Critical analysis

After the four reports land, produce a single synthesis
(`reference/research.md`) that:
- Merges the tell catalogs into one ranked list, flagging disagreements
  between sources.
- Separates "surface tells" (word/punctuation choices — cheap to fix, also
  cheap for the guidance to overfit to) from "structural tells" (uniform
  paragraph shape, symmetric list lengths, absence of genuine specificity,
  hedge-then-reassure patterns) — the latter are what the academic sources
  say actually drive detection and reader perception, so the skill must
  weight structural guidance over a banned-word list.
- Explicitly notes where "sound human" guidance conflicts with "write
  well" (e.g., some detector-evasion advice degrades clarity or accuracy)
  and resolves in favor of good writing.
- Produces the OSS-skill teardown (`reference/oss-skills-review.md`) with a
  explicit "what we're doing differently and why" section feeding the
  skill design.

## 5. Skill design

`SKILL.md` (lean, always-loadable):
- Frontmatter: `name: humanize-writing`, description starting "Use when
  producing any written text..." with concrete trigger keywords, third
  person, no workflow summary (per writing-skills SDO guidance).
- Core section: a short, high-signal set of structural principles (voice,
  specificity, rhythm/burstiness, genuine imperfection) — not a banned-word
  list as the primary mechanism, since research is expected to show
  word-list approaches are brittle and get gamed/outdated.
- A compact "common tells" quick-reference table (the cross-referenced
  consensus list from research.md), kept short — link to
  `reference/research.md` for the full backing rather than inlining it.
- **Self-review pass**: after drafting output, run a short checklist pass
  against the tell list before finalizing (per prior decision) — structured
  as a positive recipe ("check rhythm, check for stock transitions, check
  specificity") rather than a long prohibition list, per writing-skills'
  "Match the Form to the Failure" guidance (this is a shaping problem, not
  a discipline-under-pressure problem, so prohibitions are the wrong tool).
- Examples: 2-3 before/after passages in `examples/`, one clearly AI-toned
  original and its humanized rewrite, annotated with which principles fired.

## 6. Validation (lightweight, not full TDD pressure-testing)

- One before/after sample: ask Claude (fresh subagent, no skill) to write a
  short passage on a neutral topic; then ask again with the skill loaded;
  diff qualitatively against the tell list to confirm the skill measurably
  changes output.
- This is a sanity check, not exhaustive pressure-testing — per writing-skills'
  own guidance, technique/reference skills need application-scenario
  verification, not discipline-rule bulletproofing.

## 7. Adversarial review

Dispatch a fresh critic subagent (no prior context, not the drafting agent)
with:
- The finished `SKILL.md` and `reference/` docs.
- A brief to red-team against: (a) the research synthesis itself — does the
  skill actually reflect what the sources say, or drift into folk wisdom;
  (b) Anthropic's skill-authoring best practices already present on this
  machine (`writing-skills/anthropic-best-practices.md`); (c) whether
  guidance is brittle (word-list-gameable) vs. durable (structural); (d)
  token efficiency (SKILL.md word count) and SDO (description quality).
- Iterate on findings until the critic has nothing further, or findings are
  explicitly deferred with reasoning.

## 8. Install

Symlink `~/.claude/skills/humanize-writing` → the repo's skill directory,
so the installed skill and the published repo never drift apart.

## 9. Publish

New repo `humanize-writing-skill`, public, MIT license, created as a sibling
directory at `/Users/ashwinsathian/Documents/Personal/humanize-writing-skill`,
pushed to `github.com/AshwinSathian/humanize-writing-skill` via `gh repo
create`. Structure follows conventions of well-regarded public
Claude-skill/prompt repos: README (what/why/install/usage), LICENSE,
SKILL.md, `reference/`, `examples/`, no build tooling needed (it's markdown).

## 10. Success criteria

- Research synthesis cites 15+ independent credible sources across the four
  angles, with explicit consensus/disagreement notes.
- SKILL.md stays lean (target <500 words per skill-authoring conventions)
  while `reference/` carries full depth.
- Adversarial critic's initial findings are addressed or explicitly
  deferred with reasoning; no unresolved correctness-level findings.
- Skill installed locally and verified loadable; repo published and
  publicly viewable with clean structure.

## 11. Risks

- Web research quality varies; mitigate by requiring source credibility
  notes and cross-referencing rather than trusting single sources.
- Broad trigger ("everything Claude writes") risks the skill firing on
  code-heavy tasks where its guidance is irrelevant; mitigate by scoping
  the description to written/natural-language output and keeping code
  identifiers/technical terms explicitly out of scope in the guidance body.
- Over-indexing on a banned-word list would make the skill brittle and
  quickly dated; mitigate per §4/§5 by weighting structural guidance.
