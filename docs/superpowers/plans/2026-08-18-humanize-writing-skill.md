# Humanize-Writing Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, research-back, adversarially review, install, and publish a
`humanize-writing` Claude Code skill that shapes all of Claude's written
output to avoid recognizable "AI writing" tells while remaining accurate and
well-organized.

**Architecture:** A new standalone repo (sibling to `booklet`) holds a lean
`SKILL.md` plus a `reference/` directory with the full research synthesis
and OSS-skill teardown, plus `examples/` before/after passages. Research is
gathered via a parallel multi-agent fan-out, synthesized, used to draft the
skill, then red-teamed by a fresh critic agent before install and publish.

**Tech Stack:** Markdown only (SKILL.md + reference docs). No build tooling.
`git` + `gh` CLI for repo creation/publish. Claude `Agent` tool (WebSearch/
WebFetch-equipped subagents) for research and adversarial review.

**Spec:** `docs/superpowers/specs/2026-08-18-humanize-writing-skill-design.md`

## Global Constraints

- Repo name: `humanize-writing-skill`, public, MIT license, owner
  `AshwinSathian`.
- Repo location: `/Users/ashwinsathian/Documents/Personal/humanize-writing-skill`
  (sibling to this `booklet` repo).
- Skill frontmatter: `name: humanize-writing`; description starts with
  "Use when..." and covers written-text-production triggers broadly (per
  design decision: everything Claude writes), third person, no workflow
  summary.
- `SKILL.md` word budget: target under 500 words (verify with `wc -w`).
- Guidance must weight structural tells (rhythm, paragraph uniformity,
  genuine specificity) over a banned-word list, per spec §4/§5 — a
  word-list-only approach is an explicit failure mode to avoid.
- Every research report must cite sources with a one-line credibility note
  each (author/publisher + why it's trustworthy).
- Local install: symlink `~/.claude/skills/humanize-writing` → the repo's
  skill directory (never a copy — they must not drift).

---

### Task 1: Scaffold the repo

**Files:**
- Create: `/Users/ashwinsathian/Documents/Personal/humanize-writing-skill/LICENSE`
- Create: `/Users/ashwinsathian/Documents/Personal/humanize-writing-skill/README.md` (placeholder, replaced in Task 9)
- Create: `/Users/ashwinsathian/Documents/Personal/humanize-writing-skill/.gitignore`
- Create dirs: `reference/research/`, `examples/`

**Interfaces:**
- Produces: the repo root path that every later task writes into.

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p /Users/ashwinsathian/Documents/Personal/humanize-writing-skill/reference/research
mkdir -p /Users/ashwinsathian/Documents/Personal/humanize-writing-skill/examples
cd /Users/ashwinsathian/Documents/Personal/humanize-writing-skill && git init
```

- [ ] **Step 2: Write LICENSE (MIT)**

```
MIT License

Copyright (c) 2026 Ashwin Sathian

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: Write placeholder README and .gitignore**

`.gitignore`:
```
.DS_Store
```

`README.md` (placeholder — full version written in Task 9):
```markdown
# humanize-writing-skill

Work in progress.
```

- [ ] **Step 4: Verify structure and commit**

```bash
cd /Users/ashwinsathian/Documents/Personal/humanize-writing-skill
find . -type d -not -path './.git*'
```
Expected: `.`, `./reference`, `./reference/research`, `./examples`

```bash
git add LICENSE README.md .gitignore
git commit -m "Scaffold humanize-writing-skill repo"
```

---

### Task 2: Parallel research fan-out

**Files:**
- Create: `reference/research/academic.md`
- Create: `reference/research/editorial.md`
- Create: `reference/research/tells-catalog.md`
- Create: `reference/research/oss-skills.md`

**Interfaces:**
- Consumes: repo path from Task 1.
- Produces: four raw research reports consumed by Task 3 (synthesis) and
  Task 4 (OSS teardown synthesis).

- [ ] **Step 1: Dispatch four research agents in parallel (single message, four Agent tool calls, all `run_in_background: true`)**

Agent A — Academic/computational (write to `reference/research/academic.md`):
```
Research stylometry and AI-text-detection literature: what computational
linguistics and NLP research says actually distinguishes LLM-generated text
from human text (e.g. perplexity, burstiness/sentence-length variance,
token-probability distribution studies, watermarking research, linguistic
marker papers). Prioritize peer-reviewed papers, arXiv preprints from
credible labs, and writeups from recognized NLP researchers over blog
opinion pieces. For each finding, note: the claim, the source (title,
author/venue, link), and a one-line credibility note (why this source is
trustworthy — venue, author reputation, methodology). Explicitly flag any
claim that appears in only one source vs. claims with multi-source
consensus. Write the full report, with all sources cited, to
/Users/ashwinsathian/Documents/Personal/humanize-writing-skill/reference/research/academic.md
as markdown. Do not summarize into a short list — write the full findings
with citations, this file is a primary research artifact that a later
synthesis step will condense.
```

Agent B — Editorial/practitioner guides (write to `reference/research/editorial.md`):
```
Research well-regarded editorial and practitioner guidance on what makes
prose read as human-written, and specifically on AI-writing tells.
Prioritize: Wikipedia's "Signs of AI writing" essay (WP:AICLEANUP) in full
detail, established prose style guides (Strunk & White's Elements of Style,
Orwell's "Politics and the English Language," Hemingway-app style
guidance), and journalism/editing outlets' published critiques of LLM prose
(e.g. pieces from established publications or well-known editors, not
random SEO blogs). For each source, note: the guidance, the source (title,
author/publisher, link), and a one-line credibility note. Cover both
"tells to avoid" AND positive craft guidance (specificity, voice, rhythm)
since sounding human is not just tell-removal. Write the full report, with
all sources cited, to
/Users/ashwinsathian/Documents/Personal/humanize-writing-skill/reference/research/editorial.md
as markdown. Do not over-condense — this is a primary research artifact.
```

Agent C — Tell catalog cross-referencing (write to `reference/research/tells-catalog.md`):
```
Build a ranked catalog of concrete AI-writing tells (specific words,
phrases, punctuation habits, and structural patterns that read as
AI-generated), each backed by at least 2 independent well-rated sources —
not one blogger's pet peeve. Search broadly: word-level tells (e.g.
"delve", "boast", "testament to", "moreover", em-dash overuse, "it's not
just X, it's Y" constructions), structural tells (uniform paragraph
lengths, symmetric rule-of-three lists, stock transitions, hedge-then-
reassure patterns, title-case headers, listicle-itis), and explain the
mechanism for why each one reads as artificial where sources explain it.
For each tell: name it, list the corroborating sources (title,
author/publisher, link) with a one-line credibility note each, and note
if sources disagree on whether it's actually a reliable signal. Write the
full report to
/Users/ashwinsathian/Documents/Personal/humanize-writing-skill/reference/research/tells-catalog.md
as markdown.
```

Agent D — Existing OSS humanizer skills/prompts (write to `reference/research/oss-skills.md`):
```
Find existing open-source or publicly published "humanize writing" /
"sound human" / "AI writing detector" skills, prompts, or guides for LLMs —
search GitHub, agent skill marketplaces (e.g. agentskills.io), prompt
libraries, and any published Claude/GPT skills or system prompts branded
around making AI text sound human. For each one found, catalog: what it is
(link, author, stars/adoption signal if visible, last updated), what it
does well (specific, credible techniques), what it does poorly (e.g.
over-reliance on banned-word lists that get outdated/gamed, ignoring
structural tells, advice that actively hurts clarity or accuracy, no
sourcing/citations, contradicts good writing practice), and whether it
seems maintained/credible. Be critical, not just descriptive — this
report feeds a "what we do differently and why" analysis. Write the full
report to
/Users/ashwinsathian/Documents/Personal/humanize-writing-skill/reference/research/oss-skills.md
as markdown.
```

- [ ] **Step 2: Wait for all four background agents to complete**

Do not poll. Continue only once all four completion notifications have
arrived (per background-agent conventions).

- [ ] **Step 3: Verify each output file**

```bash
for f in academic editorial tells-catalog oss-skills; do
  echo "=== $f ==="; wc -w /Users/ashwinsathian/Documents/Personal/humanize-writing-skill/reference/research/$f.md
  grep -c -iE 'http|doi|isbn' /Users/ashwinsathian/Documents/Personal/humanize-writing-skill/reference/research/$f.md
done
```
Expected: each file has substantial word count (not a stub) and at least
several source references (URLs/citations) detected. If any file is thin
or has zero citations, re-dispatch that specific agent with a sharper
brief before continuing.

- [ ] **Step 4: Commit raw research**

```bash
cd /Users/ashwinsathian/Documents/Personal/humanize-writing-skill
git add reference/research/
git commit -m "Add raw research reports: academic, editorial, tells catalog, OSS skills"
```

---

### Task 3: Synthesize `reference/research.md`

**Files:**
- Create: `reference/research.md`
- Read: `reference/research/academic.md`, `reference/research/editorial.md`, `reference/research/tells-catalog.md`

**Interfaces:**
- Consumes: the three raw reports from Task 2.
- Produces: `reference/research.md`, the single source of truth Task 5
  (SKILL.md drafting) and Task 8 (adversarial review) both reference.

- [ ] **Step 1: Read all three source reports in full**

- [ ] **Step 2: Write the synthesis**

Structure `reference/research.md` as:
1. **Summary** — 1 paragraph on what the research says, overall.
2. **Ranked tell catalog** — merge the tells-catalog report with anything
   corroborating from academic/editorial reports, ranked by source-consensus
   strength (multi-source-corroborated tells first). For each: name,
   mechanism (why it reads as artificial), source citations.
3. **Structural vs. surface tells** — explicit split: surface (word/
   punctuation choices — cheap to fix, also cheap to overfit a skill to)
   vs. structural (paragraph uniformity, symmetric lists, absent
   specificity, hedge-then-reassure patterns). State plainly that academic
   sources weight structural signals more heavily than surface word
   choices, so the skill (Task 5) must do the same.
4. **Positive craft guidance** — what the editorial sources say about
   actively writing well (voice, specificity, rhythm), independent of tell-
   avoidance.
5. **Where "sound human" conflicts with "write well"** — call out any
   detector-evasion-flavored advice that would degrade clarity/accuracy,
   and state it's rejected in favor of good writing.
6. **Full source list** — every source cited above, deduplicated, each
   with its credibility note.

- [ ] **Step 3: Verify no gaps**

```bash
wc -w /Users/ashwinsathian/Documents/Personal/humanize-writing-skill/reference/research.md
grep -c '^\[.*\]:\|http' /Users/ashwinsathian/Documents/Personal/humanize-writing-skill/reference/research.md
```
Expected: nontrivial length, meaningful citation count, all 6 sections
present (`grep -c '^## '` should show 6 headers).

- [ ] **Step 4: Commit**

```bash
cd /Users/ashwinsathian/Documents/Personal/humanize-writing-skill
git add reference/research.md
git commit -m "Synthesize research findings into reference/research.md"
```

---

### Task 4: Synthesize `reference/oss-skills-review.md`

**Files:**
- Create: `reference/oss-skills-review.md`
- Read: `reference/research/oss-skills.md`

**Interfaces:**
- Consumes: the raw OSS-skills report from Task 2.
- Produces: `reference/oss-skills-review.md`, referenced by Task 5 (SKILL.md
  drafting) to justify design choices, and by Task 8 (adversarial review).

- [ ] **Step 1: Read `reference/research/oss-skills.md` in full**

- [ ] **Step 2: Write the review**

Structure `reference/oss-skills-review.md` as:
1. **Surveyed skills/prompts** — table: name, link, what it is.
2. **What they do well** — concrete, credible techniques worth keeping.
3. **What they do poorly** — patterns to avoid (banned-word-list brittleness,
   ignoring structure, clarity-harming advice, no sourcing, staleness).
4. **What we do differently and why** — explicit design decisions for this
   skill (Task 5) that respond to the gaps found here, e.g. "we weight
   structural guidance over word lists because X did the opposite and Y
   research (see research.md) shows structure matters more."

- [ ] **Step 3: Verify and commit**

```bash
cd /Users/ashwinsathian/Documents/Personal/humanize-writing-skill
wc -w reference/oss-skills-review.md
git add reference/oss-skills-review.md
git commit -m "Add OSS humanizer-skill teardown and design implications"
```

---

### Task 5: Draft `SKILL.md`

**Files:**
- Create: `SKILL.md`
- Read: `reference/research.md`, `reference/oss-skills-review.md`

**Interfaces:**
- Consumes: `reference/research.md` §2/§3/§4/§5, `reference/oss-skills-review.md` §4.
- Produces: `SKILL.md` with frontmatter `name: humanize-writing`, consumed
  by Task 6 (examples), Task 7 (validation), Task 8 (adversarial review),
  and Task 10 (install).

- [ ] **Step 1: Write `SKILL.md`**

Required shape (fill every section with real content drawn from
`reference/research.md`, not generic advice):

```markdown
---
name: humanize-writing
description: Use when producing any written text — prose, docs, comments, messages, reports — before finalizing output, to avoid recognizable AI-writing tells and read as a specific, natural human voice
---

# Humanize Writing

## Overview
[1-2 sentences: core principle — structural naturalness over word
substitution, drawn from research.md §3]

## Write this way
[The high-signal structural/craft principles from research.md §3-4:
voice, specificity, rhythm/burstiness, genuine imperfection — as a
positive recipe, not a prohibition list, per Match-the-Form-to-the-Failure]

## Common tells (quick reference)
[Compact table: tell | why it reads as artificial — top N from
research.md §2, ranked by consensus strength. Link to
reference/research.md for full backing, do not inline the full catalog]

## Before finalizing
[The self-review checklist pass: a short, positive-recipe checklist to run
against a draft before returning it — check rhythm, check for stock
transitions, check specificity, per design spec §5]

## Full research
See `reference/research.md` for sources and full analysis.
```

- [ ] **Step 2: Verify word budget and frontmatter**

```bash
cd /Users/ashwinsathian/Documents/Personal/humanize-writing-skill
wc -w SKILL.md
head -5 SKILL.md
```
Expected: word count under 500; frontmatter has `name: humanize-writing`
and a `description:` starting with "Use when".

- [ ] **Step 3: Commit**

```bash
git add SKILL.md
git commit -m "Draft SKILL.md for humanize-writing skill"
```

---

### Task 6: Before/after examples

**Files:**
- Create: `examples/before-after-1.md`
- Create: `examples/before-after-2.md`
- Read: `SKILL.md`

**Interfaces:**
- Consumes: `SKILL.md` principles from Task 5.
- Produces: example files referenced from README (Task 9).

- [ ] **Step 1: Write two before/after passages**

Each file: an "AI-toned" original passage (clearly exhibiting several
tells from the SKILL.md quick-reference table) on a distinct neutral topic,
its humanized rewrite, and a short annotation list of which SKILL.md
principles fired and why (e.g. "removed rule-of-three closer, varied
sentence length, replaced 'delve into' with a direct verb").

- [ ] **Step 2: Verify and commit**

```bash
cd /Users/ashwinsathian/Documents/Personal/humanize-writing-skill
ls examples/
git add examples/
git commit -m "Add before/after example passages"
```

---

### Task 7: Validation sample (before/after skill-loaded check)

**Files:**
- Create: `reference/validation-note.md`

**Interfaces:**
- Consumes: `SKILL.md` from Task 5.
- Produces: `reference/validation-note.md`, a short record consumed by
  Task 8 (adversarial review) as evidence the skill measurably changes
  output.

- [ ] **Step 1: Get a baseline sample (no skill)**

Dispatch a fresh subagent (no context, no skill files provided) with:
```
Write a ~150 word passage explaining why code review matters on a software
team. Just write the passage, nothing else.
```

- [ ] **Step 2: Get a skill-loaded sample**

Dispatch a second fresh subagent, this time with the full contents of
`SKILL.md` (from Task 5) included in its prompt as instructions to follow,
and the same request:
```
[paste full SKILL.md content here]

Following the above, write a ~150 word passage explaining why code review
matters on a software team. Just write the passage, nothing else.
```

- [ ] **Step 3: Diff qualitatively and record**

Compare both passages against the `reference/research.md` tell catalog.
Write `reference/validation-note.md` recording: both passages verbatim,
which tells appeared in the baseline, which were absent in the skill-
loaded version, and a one-line verdict (skill measurably changes output:
yes/no). If the verdict is "no" or weak, return to Task 5 and sharpen
`SKILL.md` before proceeding — this is the gate confirming the skill does
something.

- [ ] **Step 4: Commit**

```bash
cd /Users/ashwinsathian/Documents/Personal/humanize-writing-skill
git add reference/validation-note.md
git commit -m "Add validation sample confirming skill changes output"
```

---

### Task 8: Adversarial review and fixes

**Files:**
- Read: `SKILL.md`, `reference/research.md`, `reference/oss-skills-review.md`, `reference/validation-note.md`
- Modify: `SKILL.md`, `reference/research.md` (as needed to address findings)

**Interfaces:**
- Consumes: all artifacts from Tasks 3-7.
- Produces: a finalized `SKILL.md` and `reference/` set, gated before
  Task 9 (README) and Task 10 (install).

- [ ] **Step 1: Dispatch a fresh critic subagent**

```
You are red-teaming a Claude Code skill before it's published and installed.
You have no prior context on how it was built — review it cold.

Read these files in full:
- /Users/ashwinsathian/Documents/Personal/humanize-writing-skill/SKILL.md
- /Users/ashwinsathian/Documents/Personal/humanize-writing-skill/reference/research.md
- /Users/ashwinsathian/Documents/Personal/humanize-writing-skill/reference/oss-skills-review.md
- /Users/ashwinsathian/Documents/Personal/humanize-writing-skill/reference/validation-note.md
- /Users/ashwinsathian/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/writing-skills/anthropic-best-practices.md
- /Users/ashwinsathian/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/writing-skills/SKILL.md

Red-team SKILL.md against four criteria:
(a) Fidelity — does SKILL.md's guidance actually reflect what
    reference/research.md's sources say, or does it drift into
    unsupported folk wisdom anywhere? Flag every unsupported claim.
(b) Anthropic skill-authoring best practices — does SKILL.md follow
    anthropic-best-practices.md and the writing-skills SDO guidance
    (description quality, third person, no workflow summary in
    description, token efficiency, no placeholder/TBD content)?
(c) Brittleness — is any guidance a banned-word list that will date
    quickly or get gamed, vs. durable structural guidance? Flag every
    instance.
(d) Token efficiency — run `wc -w` on SKILL.md yourself and report
    whether it's within budget (under 500 words), and whether the
    reference/ split is actually being used correctly (heavy detail kept
    out of SKILL.md).

Report findings as a concrete, prioritized list: what's wrong, why, and
what file/line to fix. Do not fix anything yourself — report only.
```

- [ ] **Step 2: Address findings**

For each finding, either fix it directly in `SKILL.md` / `reference/*.md`
or record an explicit reason for deferring it (no silent drops). List
resolutions.

- [ ] **Step 3: Re-verify word budget after edits**

```bash
cd /Users/ashwinsathian/Documents/Personal/humanize-writing-skill
wc -w SKILL.md
```
Expected: still under 500 words.

- [ ] **Step 4: Commit**

```bash
git add SKILL.md reference/
git commit -m "Address adversarial review findings"
```

---

### Task 9: Write final README

**Files:**
- Modify: `README.md`
- Read: `SKILL.md`, `examples/before-after-1.md`, `examples/before-after-2.md`

**Interfaces:**
- Consumes: finalized `SKILL.md` from Task 8, examples from Task 6.
- Produces: the repo's public-facing entry point.

- [ ] **Step 1: Write README.md**

Cover: what this skill is and why (1 short paragraph, itself written
following the skill's own principles), install instructions (clone +
symlink, matching Task 10's exact commands), what's in `reference/` and
why it's separate from `SKILL.md`, one before/after example inlined from
`examples/`, and a link to `reference/research.md` for the full research
backing. Keep it scannable — headers, no marketing filler.

- [ ] **Step 2: Verify and commit**

```bash
cd /Users/ashwinsathian/Documents/Personal/humanize-writing-skill
git add README.md
git commit -m "Write final README"
```

---

### Task 10: Local install

**Files:**
- Create (symlink): `~/.claude/skills/humanize-writing`

**Interfaces:**
- Consumes: repo path (fixed throughout at
  `/Users/ashwinsathian/Documents/Personal/humanize-writing-skill`).
- Produces: a live, loadable skill on this machine.

- [ ] **Step 1: Create the symlink**

```bash
ln -s /Users/ashwinsathian/Documents/Personal/humanize-writing-skill ~/.claude/skills/humanize-writing
```

- [ ] **Step 2: Verify it resolves correctly**

```bash
ls -la ~/.claude/skills/humanize-writing
cat ~/.claude/skills/humanize-writing/SKILL.md | head -5
```
Expected: symlink resolves to the repo path; `SKILL.md` frontmatter visible
with `name: humanize-writing`.

---

### Task 11: Publish to GitHub

**Files:**
- None created; publishes existing repo state.

**Interfaces:**
- Consumes: the full committed repo from Tasks 1-9.

- [ ] **Step 1: Confirm clean working tree**

```bash
cd /Users/ashwinsathian/Documents/Personal/humanize-writing-skill
git status --short
```
Expected: empty (everything committed in prior tasks).

- [ ] **Step 2: Create and push the GitHub repo**

```bash
cd /Users/ashwinsathian/Documents/Personal/humanize-writing-skill
gh repo create AshwinSathian/humanize-writing-skill --public --source=. --remote=origin --push
```

- [ ] **Step 3: Verify**

```bash
gh repo view AshwinSathian/humanize-writing-skill --web=false
```
Expected: repo metadata prints, confirming it's live and public.

---

## Self-Review Notes

- **Spec coverage:** §3 research plan → Task 2; §4 critical analysis →
  Tasks 3-4; §5 skill design → Tasks 5-6; §6 validation → Task 7; §7
  adversarial review → Task 8; §8 install → Task 10; §9 publish → Task 11.
  All spec sections have a task.
- **Placeholder scan:** all steps contain literal commands/content; no
  "TBD"/"add appropriate X" left in task bodies.
- **Type/name consistency:** repo path, skill name (`humanize-writing`),
  and file paths (`reference/research.md`, `reference/oss-skills-review.md`,
  `SKILL.md`) are used identically across all tasks that reference them.
