# Readable — Product Explainer

> A plain-English document explaining what Readable is, how it works, who it's for,
> and what makes it distinct. Use this as context for any Claude conversation where
> you need the product explained accurately — content creation, FAQs, docs, pitches,
> investor briefs, demo scripts, onboarding copy, etc.

---

## The One-Sentence Version

Readable is a free web tool that turns Markdown text into a clean, beautifully formatted,
publicly shareable page — instantly, with no account required.

---

## The Problem

Markdown is the default writing format for technical people. Engineers write READMEs, incident
reports, architecture decision records (ADRs), runbooks, proposals, and meeting notes in
Markdown every day. It's fast, structured, and universally understood within technical teams.

The problem is that Markdown is meant to be *rendered*, not read raw. When a raw Markdown
file gets forwarded outside the technical team — to a product manager, a customer, a designer,
an executive, a support team — it looks like this:

```
## Incident Summary

**Severity:** P1  
**Status:** Resolved

### Root Cause

The database connection pool was misconfigured after Tuesday's deploy.

- Pool size set to `5` instead of `50`
- Health check delayed by 90 seconds
- Alert threshold set too high
```

To a non-technical reader, that's noise. The hashes, asterisks, and backticks break the
reading experience and make the content feel unfinished.

The alternatives — pasting into Google Docs, creating a Confluence page, opening a Notion
doc — all require effort, accounts, or access that the recipient may not have. So the
content either gets stripped of its formatting (losing all structure) or it never gets shared
at all.

**Readable solves this with one step: paste and publish.**

---

## What Readable Does

1. **You paste Markdown** into the editor. Any Markdown — a README, a post-mortem, an ADR,
   a proposal, a changelog, meeting notes, anything.

2. **You see it rendered** in real time on the right-hand side of the editor — exactly as
   it will appear to readers. Headings, bold text, code blocks, tables, bullet lists,
   task checkboxes, blockquotes, inline code, diagrams — all rendered with beautiful
   typography and proper spacing.

3. **You hit Publish** (or press ⌘↵). Readable generates a unique public URL
   (e.g. `readable.app/p/Ab3k91QxZp`) in under a second.

4. **You send the link.** The recipient opens a clean, well-formatted reading page in
   their browser. No login. No app. No friction.

---

## The User Experience in Detail

### The editor
The editor is a split-pane interface: Markdown input on the left, live rendered preview
on the right. The preview updates in real time as you type (debounced at 120ms, so it never
lags). The editor is distraction-free — no formatting toolbar, no rich text widgets. You
write in Markdown and the preview handles everything.

Drafts are saved automatically to the browser's `localStorage` — nothing is transmitted to
any server until you explicitly publish. You can have multiple named drafts, switch between
them, rename them, duplicate them, or delete them. Drafts persist across sessions and
browser restarts.

### Publishing
When you're ready, you hit the Publish button or press ⌘↵. Readable sends your content to
the server, stores it, and returns a 10-character unique ID. The full public URL is shown
immediately and can be copied with one click.

Publishing is rate-limited to prevent abuse (12 publishes per minute per IP). Each publish
creates a new, independent snapshot — you cannot edit a published page.

### The published page
The published page is a clean, read-only reading experience. It has:
- A minimal sticky header with the Readable logo, a theme toggle (dark/light), a print
  button, an expiry countdown badge, and a "Make your own →" CTA
- The full rendered document with proper typographic hierarchy
- An auto-generated Table of Contents on pages with 3 or more headings (scroll-tracked on
  desktop, collapsible accordion on mobile)
- A clean footer showing the publish date and a link to create your own page
- No ads, no tracking pixels, no cookie banners, no social share buttons

The page is fully printable — pressing ⌘P or using File → Print produces a clean, chrome-
free PDF of the content.

### Page lifespan
Anonymous pages (published without signing in) expire after **30 days**. The expiry
countdown is visible on the page so readers always know. Signed-in users who own a page
can publish pages that don't expire.

---

## Key Features

### Live split-pane editor
Real-time Markdown preview as you type. The rendered view is pixel-for-pixel what readers
will see. No "save to preview" step.

### One-click publish
A single click (or ⌘↵) creates the public URL. The entire workflow from paste to shareable
link takes under 30 seconds.

### Beautiful typography out of the box
All Markdown elements are rendered with care:
- Headings with size hierarchy and tight tracking
- Body text at 15–16px with generous line-height (1.8)
- Fenced code blocks with a macOS-style header, language label, line count, copy button,
  and optional collapse for long blocks
- Tables with alternating row shading and hover highlight
- Blockquotes with a purple accent border
- Task lists with checkboxes (read-only)
- Inline code in a monospace typeface with subtle background
- Images (external URLs only) with rounded corners and optional caption

### Table of Contents
For documents with 3 or more headings, Readable auto-generates a Table of Contents.
On desktop it appears as a sticky sidebar on the right, with the active heading highlighted
as you scroll (via IntersectionObserver). On mobile it appears as a collapsible accordion
above the content.

### Multiple drafts
Unlimited local drafts stored in `localStorage`. Each has a name (editable inline),
a creation date, and a character/word count. The drafts panel lets you switch between,
duplicate, or delete any draft.

### Export
From the editor you can:
- Copy the rendered page as clean HTML
- Download the raw Markdown as a `.md` file

### Theme toggle
Dark and light modes. Dark is the default (and primary brand expression). The toggle
persists across sessions. The theme is dark-first to prevent a white flash on load.

### Diagram support
Mermaid diagrams and other diagram syntaxes are rendered inline on both the editor preview
and the published page.

### Unlisted pages
Signed-in users can publish a page as "unlisted" — it's publicly accessible via the link
but excluded from any indexing or discovery. Useful for sensitive content you want to share
with a specific person but not the world.

### Custom slugs
Signed-in users can set a human-readable slug for their published page, e.g.
`readable.app/p/q4-incident-summary` instead of the auto-generated ID.

### View counts
Readable tracks how many times a published page has been viewed. Available to the page
owner in the "My pages" dashboard.

### API
Readable has a REST API for publishing pages programmatically. Use cases include:
- Publishing post-mortems automatically from incident management tools
- Publishing release notes from a CI/CD pipeline
- Publishing changelogs as part of a GitHub Action
Signed-in users can generate API keys in the My Pages dashboard.

---

## What Readable Does Not Do

These are intentional omissions, not missing features:

- **No real-time collaboration** — Readable is not Google Docs. There is no co-editing,
  no comments, no mentions, no version history.
- **No editing after publish** — Published pages are immutable snapshots. To update,
  edit the draft and republish (which creates a new link).
- **No private pages** — Every published page is publicly accessible to anyone with
  the URL. There is no password protection or access control (unlisted mode hides it
  from discovery but does not restrict access).
- **No permanent storage for anonymous users** — Anonymous pages expire after 30 days.
  If you need permanent pages, sign in.
- **No rich text editing** — The editor is plain Markdown only. There is no WYSIWYG
  toolbar or drag-and-drop formatting.
- **No embedded media** — Readable renders external image URLs but does not host or
  embed video, audio, or interactive content.
- **No search** — There is no public directory or search index of Readable pages.

---

## Technical Architecture (for context)

Understanding the tech helps when writing accurate product copy or answering technical
questions.

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Auth | Clerk |
| Markdown parsing | unified / remark / remark-gfm |
| Rendering | Custom AST renderer — never `dangerouslySetInnerHTML` (XSS-safe) |
| Storage | Cloudflare KV (published pages) + Cloudflare D1 (owned pages, user data) |
| Infrastructure | Cloudflare Workers via OpenNext |
| Rate limiting | KV-based counter (12 publishes/min per IP) |
| Analytics | Google Analytics 4 |

**Key architectural facts that affect product copy:**
- Drafts live in `localStorage` — they are 100% private until published
- Published pages are stored in Cloudflare KV at the edge — extremely fast globally
- The custom renderer means all Markdown content is sanitised before display — no XSS risk
- The platform is stateless for anonymous users — no cookies, no sessions, no tracking
  until the moment of publish

---

## Pricing

Readable is **free**. There is no paid tier, no freemium model, no credit card required.

- Anonymous use (no account): free, unlimited drafts, pages expire in 30 days
- Signed-in use (Clerk account): free, pages are permanent, custom slugs, API access,
  view count tracking, unlisted pages, My Pages dashboard

---

## The Name

"Readable" is a direct statement of the product's purpose: it makes Markdown *readable*
to people who don't know Markdown. The name is a quality descriptor, not a company name —
it describes what the output is, not who made it.

---

## Founder

Readable was built by **Ashwin Sathian**, a software engineer. It started as a personal
tool to solve a problem he encountered daily: writing beautifully structured Markdown and
then having it fall apart when shared with non-technical colleagues. The product is
intentionally minimal — it solves one problem very well.

Contact: ashwinsathyan19@gmail.com

---

## Frequently Asked Questions

**Do I need an account to use Readable?**
No. You can paste, preview, and publish without signing in. An account (via Google, GitHub,
or email through Clerk) is optional and unlocks permanent pages, custom slugs, the API,
and the My Pages dashboard.

**Is my content private before I publish?**
Yes. Drafts are stored entirely in your browser's localStorage and are never sent to any
server. Nothing leaves your device until you click Publish.

**Can I edit a page after publishing?**
No. Published pages are immutable. You can edit your local draft and republish — which
creates a new URL. The old URL continues to work until it expires.

**What happens when a page expires?**
After 30 days, the page is removed from storage and the URL returns a "page not found"
screen. There is no warning email. The page itself shows an expiry countdown so readers
can see when it will expire.

**Can I use Readable for sensitive or confidential content?**
Use caution. Any published page is accessible to anyone with the link. There is no
password protection. If you're sharing sensitive content, use the "unlisted" option (which
hides it from discovery) and ensure you only share the link with trusted parties. For
truly confidential content, Readable is not the right tool.

**Does Readable support all Markdown features?**
Readable supports GitHub-Flavored Markdown (GFM) — the most widely used Markdown dialect.
This includes: headings (H1–H4), bold, italic, strikethrough, code (inline and fenced),
tables, ordered and unordered lists, nested lists, task lists, blockquotes, horizontal
rules, images (external URLs), links, and Mermaid diagrams. HTML in Markdown is not
rendered for security reasons.

**Is there a character or file size limit?**
The editor accepts up to 200,000 characters of Markdown input. Published page payloads
are capped at 350,000 bytes to keep Cloudflare KV storage efficient.

**Can I use the API without signing in?**
No. API access requires a signed-in account and a generated API key.

**What does the URL look like?**
Anonymous publish: `readable.app/p/Ab3k91QxZp` (10-character random ID).
With custom slug: `readable.app/p/q4-incident-summary`.

---

*Last updated: April 2026.*
