# Readable — Brand & Product Reference

> Paste this document into Claude before asking it to generate any branding materials,
> marketing copy, social posts, ad creative, email campaigns, or design briefs.

---

## What Readable Is

Readable is a Markdown-to-shareable-page tool. Paste any Markdown text into the editor, see it rendered beautifully in real time, and publish it to a clean public URL with one click. The link is permanent for 30 days and requires nothing from the reader — no login, no app, no plugin.

**The core insight:** Engineers and technical people write in Markdown. Their stakeholders, customers, and non-technical colleagues cannot read raw Markdown. Readable bridges that gap silently — nobody has to change their tools or their workflow.

**One-line description:**  
*"Paste Markdown. Get a page worth sharing."*

**Tagline:**  
*"Built for clarity."*

---

## The Problem It Solves

Technical people write beautifully structured content — incident reports, architecture decisions, onboarding docs, release notes, proposals — but the medium they write in (Markdown) is invisible to the people who need to read it. When you paste raw Markdown into Slack or email, the recipient sees a wall of asterisks, hashes, and backticks instead of a formatted document.

The alternatives are all high-friction:
- Google Docs / Notion require everyone to have an account
- GitHub requires the reader to navigate a repo
- Confluence requires corporate access
- Copy-pasting into an email destroys all formatting

Readable is the zero-friction path: one link, opens in any browser, reads like a proper document.

---

## Product Overview

| | |
|---|---|
| **Input** | Any Markdown (GFM — headings, bold, italic, code, tables, lists, blockquotes, task lists, diagrams) |
| **Output** | A clean, read-only public URL (e.g. `readable.app/p/Ab3k91QxZp`) |
| **Time to publish** | Under 30 seconds |
| **Account required** | No — drafts stay in browser localStorage until the user deliberately publishes |
| **Reader requirements** | None — just a browser |
| **Page lifespan** | 30 days (anonymous); permanent for signed-in users who own the page |
| **Price** | Free |
| **API** | Yes — REST API with API key auth for CI/scripting use |
| **Platform** | Web app, any browser |

### Key features
- **Live split-pane editor** — Markdown on the left, beautifully rendered preview on the right, updated in real time
- **One-click publish** — keyboard shortcut ⌘↵ or the Publish button; generates a unique URL instantly
- **Beautiful typography** — headings, code blocks (with copy button), tables, blockquotes, inline code, task lists — all rendered with care; zero configuration
- **Table of Contents** — auto-generated on published pages with ≥3 headings; scroll-tracked on desktop, accordion on mobile
- **Expiry badge** — published pages show a countdown so readers know the content is time-limited
- **Print to PDF** — published pages produce a clean, chrome-free PDF from the browser
- **Multiple drafts** — unlimited local drafts with auto-save; rename, duplicate, delete from a drafts panel
- **Export** — copy as HTML or download the raw Markdown
- **Unlisted pages** — published but excluded from any index; link-only access
- **Custom slugs** — signed-in users can set a human-readable slug for their page URL
- **Diagram rendering** — Mermaid and other diagram syntaxes rendered inline
- **Dark / light mode** — system default with manual toggle; dark is the primary mode

---

## Target Audience

### Primary: The technical writer-sharer
Software engineers, engineering managers, DevOps/SRE, product engineers, technical leads. People who:
- Write in Markdown daily (READMEs, ADRs, runbooks, tickets, notes)
- Need to communicate outcomes to non-technical stakeholders (PMs, leadership, customers, support)
- Are frustrated by the gap between how they write and how their writing looks to others
- Value speed and zero friction above all else — they are not going to spend 10 minutes formatting a Google Doc

### Secondary: Technical teams broadly
- Engineering teams sharing incident post-mortems
- Platform/DevEx teams distributing internal docs
- Technical writers creating lightweight reference pages
- Open-source maintainers sharing changelogs or onboarding guides
- Consultants or contractors sharing proposals and reports

### Who is NOT the audience
- People who want real-time collaboration (use Notion, Google Docs)
- People who want a full CMS (use Contentful, Sanity)
- Non-technical writers who don't already work in Markdown

---

## Brand Identity

### Personality
**Calm. Precise. Confident. Invisible.**

Readable's brand personality mirrors the product: it exists to make other things look good, not to call attention to itself. It is the tool that disappears when you're using it. The brand communicates like a senior engineer who is also a great writer — direct, clear, no noise, no filler.

Readable is not playful. It is not corporate. It is not aspirational in a Silicon Valley sense. It is quietly excellent.

### Voice & tone

| Do | Don't |
|---|---|
| Short sentences. One idea at a time. | Paragraph-long sentences with multiple clauses |
| Confident declarations ("Readable turns your text into…") | Hedged language ("can help you maybe…") |
| Concrete use cases ("incident reports, ADRs, READMEs") | Vague abstractions ("all kinds of content") |
| Second person, present tense ("Your Markdown. Their reading.") | Third person or passive voice |
| Technical vocabulary used correctly (Markdown, ADR, GFM, URL) | Dumbing down or over-explaining tech concepts |
| Specific numbers ("under 30 seconds", "30 days") | Meaningless superlatives ("blazing fast") |
| "Paste. Publish. Share." | "Revolutionize your workflow" |

### Copy hierarchy
1. **Hero headline** — 3–8 words, declarative, names the transformation. *"Write in Markdown. Get a page worth sharing."*
2. **Sub-headline** — 1–2 sentences, names what the product does and removes the biggest objection. *"Readable turns your plain text into a beautifully formatted page — shareable with a single link. No setup, no noise."*
3. **Trust signals** — removes friction: *"Free · No account · Published in seconds"*
4. **Feature copy** — benefit-first headline (not feature name), one-sentence description. *"Beautiful by default — Typography, code blocks, tables, headings — all rendered with care. Zero configuration, zero CSS, zero effort."*

---

## Colours

### Dark mode (primary — use this for all dark-background creative)

| Name | Hex / Value | Usage |
|---|---|---|
| Background | `#000000` | Page base, hero backgrounds |
| Surface | `#0d0d0d` | Navbar, subtle backgrounds |
| Elevated | `#161617` | Cards, modals, panels |
| Text — Primary | `#f5f5f7` | Headlines, body text |
| Text — Secondary | `#98989f` | Subtitles, supporting copy |
| Text — Muted | `#636366` | Captions, metadata, hints |
| **Accent (Readable Purple)** | **`#7c5cfc`** | **CTAs, links, active states, brand moments** |
| Accent soft | `#a78bfa` | Hover states, focus rings, gradient midpoints |
| Accent warm | `#f59e0b` | Warnings, expiry, amber callouts |
| Border | `rgba(255,255,255,0.09)` | Card borders, dividers |

### Light mode

| Name | Hex / Value |
|---|---|
| Background | `#ffffff` |
| Surface | `#f5f5f7` |
| Elevated | `#e8e8ed` |
| Text — Primary | `#1d1d1f` |
| Text — Secondary | `#6e6e73` |
| Text — Muted | `#86868b` |
| Accent | `#6741f0` |

### Gradient (hero / key brand moments)
```
from: #7c5cfc   via: #a78bfa   to: #7c5cfc
direction: left to right (90deg)
```
Applied to: the second line of the hero headline, key headline moments in marketing.

### The rules
- Purple (`#7c5cfc`) is used for **action and active states only** — not decoration, not category colour
- Never use more than one accent colour in a single visual
- Dark mode is the primary brand expression; always design dark-first

---

## Typography

| Role | Size | Weight | Tracking | Line-height |
|---|---|---|---|---|
| Hero H1 | 52–88px (responsive) | 800 | −0.04em | 1.02 |
| Section H2 | 30–40px | 700 | −0.03em | 1.14 |
| Feature title | 15px | 600 | tight | — |
| Body / subtitle | 17px | 400 | normal | 1.75 |
| Caption / meta | 11–13px | 400–500 | normal | — |
| Eyebrow label | 10px | 600 | 0.24em | — |
| Monospace (code) | 13px | 400 | normal | 1.65 |

**Typeface:** Inter (all weights). Self-hosted via Next.js.  
**Monospace:** JetBrains Mono / Fira Code / SF Mono (system fallback).  
**Font features:** `cv02, cv03, cv04, cv11, ss01` — enables Inter's alternate digit forms and refined punctuation.

---

## Logo & Mark

**The mark** is a rounded square in Readable Purple (`#7c5cfc`) containing a clean SVG letterform of the letter **R** — vertical stem, upper arch, diagonal leg — rendered in white at 2.2px stroke weight with round caps and joins.

**The wordmark** is "Readable" set in Inter Semibold (600), 14px, tight tracking, in `#f5f5f7` (dark) or `#1d1d1f` (light).

**Usage:**
- Mark + wordmark together: navigation, email headers
- Mark alone: favicon, app icon, footer, social profile images
- Never stretch, recolour, or apply drop shadows to the mark
- Minimum clear space: equal to the mark's border-radius on all sides

---

## Key Messages

### For marketing headlines (pick any)
- "Write in Markdown. Get a page worth sharing."
- "Markdown, made beautiful."
- "Paste once. Share a page people actually read."
- "Your writing, the way it was meant to be read."
- "Beautiful pages. Instantly."
- "The space between writing Markdown and making it readable."

### For sub-headlines / body copy
- "No signup, no onboarding. Paste and you're in the editor."
- "Typography, spacing, and layout — handled so your content lands the way you meant it."
- "When your message gets escalated or CC'd, the structure stays intact."
- "Nothing stored until you deliberately hit publish."
- "Send in Slack, email, or a ticket. They just read."

### For social / short-form
- "Markdown → beautiful page → link → done."
- "Stop pasting raw Markdown into Slack. There's a better way."
- "Your incident report deserves to look like you wrote it on purpose."
- "ADRs, READMEs, post-mortems, proposals. One link. Anyone can read it."
- "The fastest way to share something that looks like you spent time on it."

### For CTAs
- "Open the editor — it's free"
- "Try it now"
- "See a live example"
- "Paste your first draft"

---

## Use Cases (with proof)

These are the primary use cases that resonate most with the audience. Always use specific, concrete examples rather than generic descriptions.

| Use case | The pain | Readable's role |
|---|---|---|
| **Incident summaries / post-mortems** | Raw Markdown pasted into Slack is unreadable; Google Docs requires an account | A link anyone can open, structure intact, timeline clear |
| **Architecture decision records (ADRs)** | ADRs live in repos — inaccessible to non-engineers | A shareable link that explains the decision in context |
| **README-style docs** | GitHub requires a login and a repo-navigation mental model | A plain URL that reads like a proper document |
| **Release notes** | Buried in PRs or CHANGELOG.md files | A clean page stakeholders can actually read |
| **Onboarding guides** | Google Docs for internal docs requires IT provisioning | A Readable link you can paste in a welcome Slack message |
| **Proposals / briefs** | Writing in Markdown, formatting in another tool wastes time | Publish from the Markdown, skip the formatting step |
| **CI/CD publishing via API** | Manual publishing doesn't scale | The Readable API publishes pages from pipelines automatically |

---

## What Readable Is Not

Be explicit about this to avoid misleading positioning:

- **Not a CMS** — pages are not editable after publishing; they are immutable snapshots
- **Not a collaboration tool** — no comments, no co-editing, no mentions
- **Not a note-taking app** — Readable doesn't store notes; it publishes them
- **Not a permanent host** — anonymous pages expire after 30 days (owned pages are permanent)
- **Not a private tool** — published pages are accessible to anyone with the link

---

## Competitive Positioning

| Tool | Why users reach for it | Why Readable wins |
|---|---|---|
| Google Docs | Rich formatting, familiar | Requires Google account; slow; not Markdown-native |
| Notion | Beautiful output, flexible | Requires workspace access; heavy onboarding |
| GitHub Gists | Developer-native | Ugly rendering; no sharing-optimised page |
| HackMD / StackEdit | Markdown-native | Collaborative overkill; not optimised for sharing |
| Confluence | Enterprise docs | Requires corporate SSO; slow; heavyweight |
| Pasting into Slack/email | Zero friction | Destroys all formatting; no permanent link |

**Readable's position:** The fastest, most beautiful path from Markdown to a link someone can actually read. Not a full tool — a sharp one.

---

## Tone in Specific Contexts

### Product announcements
Lead with what changed for the user, not what changed in the code. One sentence of context, one of impact. Short. No changelog-speak.

### Social media (LinkedIn, Twitter/X)
- Open with the pain or the scenario, not the product name
- Use line breaks aggressively — no walls of text
- End with a concrete, specific CTA (link or "Open the editor — free")
- Avoid: hashtag spam, emoji overload, hollow hype words

### Ad copy
- Headline: name the transformation (input → output) in under 8 words
- Body: remove one specific objection (no account, free, 30 seconds)
- CTA: verb-first, specific ("Try the editor free" not "Learn more")

### Email
- Subject: specific scenario or use case, not product feature
  - ✅ "Stop pasting raw Markdown into Slack"
  - ❌ "Announcing Readable's new sharing features"
- Body: 3 paragraphs max. Problem → Solution → CTA.
- Signature: "Built for clarity. — The Readable team"

### Developer/technical content
- Use correct terminology (Markdown, GFM, localStorage, Cloudflare KV, API key)
- Show real code examples for API/CLI use cases
- Don't over-explain concepts the audience already knows
- Acknowledge the technical sophistication of the audience

---

## Things to Always Include

When generating any marketing asset:

1. **The zero-friction proof point** — "no account", "free", "under 30 seconds", or all three
2. **The transformation** — from (raw Markdown / technical draft) to (beautiful / shareable / readable page)
3. **At least one specific use case** — incident report, ADR, README, or post-mortem
4. **The CTA** — always link to the editor at `/app`, never to a sign-up page

## Things to Never Write

- "Revolutionary", "game-changing", "disrupting", "paradigm shift"
- "All-in-one", "end-to-end", "seamless", "robust", "powerful solution"
- "We're excited to announce…"
- Any claim about collaboration, real-time co-editing, or permanent storage of anonymous pages
- Markdown rendered as literal characters in marketing copy (e.g. `**bold**` or `## Heading`) — always show rendered output

---

*Last updated: April 2026. For questions about the product, contact Ashwin Sathian (ashwinsathyan19@gmail.com).*
