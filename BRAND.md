# Readable — Brand Reference

> The canonical source of truth for Readable's brand identity. Paste this document into
> Claude before generating any branding materials, marketing copy, social posts, ad creative,
> email campaigns, design briefs, or UI copy decisions.

---

## Design Philosophy

**Readable's design north star: Apple-quality execution.**

That means:

- **Type is the product.** The UI exists to exemplify beautiful typography — every layout decision should make the content look better, not the chrome louder.
- **Chrome recedes.** Surfaces carry content; they don't call attention to themselves. No gradients on structural elements, no decorative borders, no shadow theatre.
- **Purple = action/active only.** The accent colour is reserved for CTAs, links, active states, and brand moments. Never for decoration, category colour, or background fills.
- **Three surfaces.** The visual hierarchy uses exactly three background levels: base → elevated → glass. Don't invent a fourth.
- **Motion has purpose.** Entrances orient. Micro-interactions confirm. Nothing moves just because it can.
- **Dark-first.** Dark mode is the primary brand expression. Always design dark-first, then verify light. Never invert this.
- **One idea per section.** Every section of a page or screen communicates one thing. If you can't name the section's one idea, it needs to be split or cut.

---

## Brand Personality

**Calm. Precise. Confident. Invisible.**

Readable mirrors its product: it exists to make other things look good, not to call attention to itself. The brand communicates like a senior engineer who is also a great writer — direct, clear, no noise, no filler.

| Adjective | What it means in practice |
|---|---|
| **Calm** | No urgency theatre, no countdown timers, no exclamation marks in UI |
| **Precise** | Concrete numbers, specific examples, correct technical vocabulary |
| **Confident** | Declarative statements, not hedged claims |
| **Invisible** | The product surfaces the user's content; Readable's brand gets out of the way |

Readable is not playful. It is not corporate. It is not aspirational in a Silicon Valley sense. It is quietly excellent.

---

## Colour System

### Design tokens — Dark mode (primary)

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#000000` | Base — Apple-premium pure black |
| `--color-bg-soft` | `#0d0d0d` | Nav, input backgrounds, subtle step |
| `--color-bg-elevated` | `#161617` | Cards, dialogs, panels |
| `--color-bg-glass` | `rgba(22, 22, 23, 0.72)` | Backdrop-blur floating surfaces |
| `--color-text-primary` | `#f5f5f7` | Apple primary label |
| `--color-text-secondary` | `#98989f` | Apple secondary label |
| `--color-text-muted` | `#636366` | Apple tertiary label |
| `--color-accent` | `#7c5cfc` | Readable signature purple — action/active |
| `--color-accent-hover` | `#6b48f0` | Accent on hover |
| `--color-accent-soft` | `#a78bfa` | Focus rings, secondary tints |
| `--color-accent-warm` | `#f59e0b` | Amber — warnings, expiry, time-sensitive |
| `--color-accent-dim` | `rgba(124, 92, 252, 0.12)` | Icon backgrounds, subtle fills |
| `--color-border-strong` | `rgba(255, 255, 255, 0.16)` | Prominent dividers, active borders |
| `--color-border-default` | `rgba(255, 255, 255, 0.09)` | Standard card borders, dividers |
| `--color-border-subtle` | `rgba(255, 255, 255, 0.05)` | Background separators |
| `--color-fill-1` | `rgba(255, 255, 255, 0.04)` | Table row alternates |
| `--color-fill-2` | `rgba(255, 255, 255, 0.08)` | Code headers, inset panels |
| `--color-fill-3` | `rgba(255, 255, 255, 0.13)` | Table head, button hover |
| `--shadow-soft` | `0 4px 14px rgba(124, 92, 252, 0.35)` | Primary button glow |
| `--shadow-glass` | `0 8px 48px rgba(0, 0, 0, 0.70)` | Hero mock / modal shadow |
| `--shadow-glow` | `0 0 80px rgba(124, 92, 252, 0.20)` | CTA section ambient glow |
| `--shadow-card` | `0 1px 2px rgba(0,0,0,0.60), 0 4px 24px rgba(0,0,0,0.40)` | Card depth |

### Design tokens — Light mode

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#ffffff` | Apple pure white |
| `--color-bg-soft` | `#f5f5f7` | Apple systemGroupedBackground |
| `--color-bg-elevated` | `#e8e8ed` | Apple secondarySystemBackground |
| `--color-bg-glass` | `rgba(255, 255, 255, 0.90)` | Frosted glass surfaces |
| `--color-text-primary` | `#1d1d1f` | Apple label |
| `--color-text-secondary` | `#6e6e73` | Apple secondaryLabel |
| `--color-text-muted` | `#86868b` | Apple tertiaryLabel |
| `--color-accent` | `#6741f0` | Readable purple, light variant |
| `--color-accent-hover` | `#5530de` | |
| `--color-accent-soft` | `#8b6cf7` | |
| `--color-accent-warm` | `#d97706` | |
| `--color-accent-dim` | `rgba(103, 65, 240, 0.10)` | |
| `--color-border-strong` | `rgba(0, 0, 0, 0.14)` | |
| `--color-border-default` | `rgba(0, 0, 0, 0.09)` | |
| `--color-border-subtle` | `rgba(0, 0, 0, 0.05)` | |

### Colour rules

- **Purple is for action and active states only.** Never use it as a category colour, background, or decorative element.
- **Never use more than one accent colour in a single visual.** Purple and amber cannot appear in the same design unit.
- **Dark mode is the primary brand expression.** All brand assets, screenshots, and marketing visuals default to dark.
- The `--color-outline` token (legacy alias for `--color-border-default`) is `rgba(255,255,255,0.09)` in dark mode. Do not revert to the old `#1e2840` navy value.

### Hero gradient (brand moments only)

Used on: the second line of the hero headline, key CTA moments in marketing.

```
direction: 90deg (left → right)
from:  #7c5cfc
via:   #a78bfa
to:    #7c5cfc
```

CSS: `background: linear-gradient(90deg, #7c5cfc, #a78bfa, #7c5cfc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`

Use sparingly — one gradient element per page maximum.

---

## Typography

**Primary typeface:** Inter (all weights). Self-hosted via Next.js `next/font`. Used for all app/editor chrome.  
**Reading typeface:** Source Serif 4 (400/500/600/700, italic). Self-hosted via `next/font`. Used for published-page body content (`BlockRenderer` in serif mode — `DocSettings.typeface`, default `"serif"`) — deliberately distinct from the UI font, so the artifact people screenshot and share reads as a considered editorial page, not generic app chrome. Authors can opt back into Inter per-document via the editor's "Reading typeface" toggle. Body copy in this mode: 18–19px, 1.7 line-height, ~68ch measure.  
**Monospace typeface:** JetBrains Mono → Fira Code → Cascadia Code → SF Mono (system fallback).  
**Font features:** `"cv02", "cv03", "cv04", "cv11", "ss01"` — enables Inter's alternate digit forms and refined punctuation.  
**Base font size:** 17px (Apple canonical body size).

### Type scale

| Role | Size | Weight | Tracking | Line-height | Usage |
|---|---|---|---|---|---|
| Hero H1 | 52px → 72px → 88px | 800 | −0.04em | 1.02 | Landing page hero only |
| Section H2 | 30px → 40px | 700 | −0.03em | 1.14 | Section headlines |
| Feature title | 15px | 600 | tight | — | Feature card headers |
| Body / subtitle | 17px | 400 | normal | 1.75 | Paragraphs, subtitles |
| Body small | 15px | 400 | normal | 1.72 | Card descriptions |
| Caption / meta | 11–13px | 400–500 | normal | — | Dates, counts, hints |
| Eyebrow label | 10px | 600 | 0.24em | — | Section eyebrows, uppercase |
| Monospace | 13px | 400 | normal | 1.65 | Code blocks, URLs |
| UI small | 13px | 500–600 | tight | — | Buttons, tabs, labels |

### Typography rules

- Headlines use `text-balance` for multi-line wrap.
- Body copy uses `text-pretty` for natural paragraph wrapping.
- **Never** set a heading below H1 at a size larger than the level above it.
- Monospace content always uses `font-mono` (JetBrains Mono).
- Eyebrow labels are always `uppercase tracking-[0.24em] text-accent`.
- Don't mix font weights within a single sentence.

### Responsive headline breakpoints

```
Hero H1:
  mobile:  52px  / lh: 1.02 / tracking: -0.04em
  sm:      72px
  lg:      88px

Section H2:
  mobile:  30px  / lh: 1.14 / tracking: -0.03em
  sm:      40px
```

---

## Logo & Mark

### The mark

A rounded square in Readable Purple (`#7c5cfc`) containing a clean SVG letterform of the letter **R**:
- Vertical stem, upper arch, diagonal leg
- Rendered in `#ffffff` (white)
- 2.2px stroke weight, round caps and joins
- Corner radius matches the container's rounded square

### The wordmark

"Readable" set in Inter Semibold (600), tight tracking, in `#f5f5f7` (dark mode) or `#1d1d1f` (light mode).

### Lockups

| Lockup | Where to use |
|---|---|
| Mark + wordmark | Navigation, email headers, documents |
| Mark alone | Favicon, app icon, footer icon, social profile images |
| Wordmark alone | Never — always accompany with the mark |

### Usage rules

- Never stretch, squash, recolour, or apply drop shadows to the mark
- Never place the mark on a coloured background other than pure black, pure white, or the exact Readable Purple
- Minimum clear space: equal to the mark's border-radius on all four sides
- Minimum mark size: 16px × 16px (favicon context); 24px × 24px (any visible UI context)

---

## Motion & Animation

### Principles

- **Entrances orient.** Elements fade-in upward (fadeUp) to communicate arrival, not to show off.
- **Micros confirm.** Button presses, copy actions, publishes — all get a micro-response (scale, colour, icon swap).
- **Reduced motion is first-class.** All framer-motion variants respect `useReducedMotion`. Pass `undefined` variants when `reduce === true`.
- **Duration hierarchy:**
  - `100ms` — color, opacity: micro-interactions
  - `180ms` — standard UI: hover, focus states
  - `280ms` — entrance animations: elements entering the viewport
  - `400ms` — full-panel / dialog open

### Named easing curves

| Token | Value | Use for |
|---|---|---|
| `--ease-spring` | `cubic-bezier(0.16, 1, 0.3, 1)` | All entrances, interactive confirms |
| `--ease-smooth` | `cubic-bezier(0.4, 0, 0.2, 1)` | Layout changes, reorder |
| `--ease-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Copy-success states, pill actives |

### Standard entry animation

```ts
// fadeUp — standard element entrance
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(4px)" },
  show: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] },
  },
};

// stagger — wraps children to sequence their entries
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
```

### Rules

- Use `whileInView` with `viewport={{ once: true, margin: "-80px" }}` for scroll-triggered entrances.
- Hero elements use `animate` (not `whileInView`) since they are above the fold.
- Never animate layout properties (`width`, `height`, `padding`). Animate `opacity`, `transform` (y, scale), and `filter` only.
- Button hover uses CSS transitions (`transition hover:bg-accent-hover active:scale-[0.97]`), not framer-motion.

---

## Spacing & Layout

### Grid

- Max content width: `max-w-6xl` (72rem) with `px-5 sm:px-8` horizontal gutter
- Section padding: `py-20 sm:py-28`
- Card internal padding: `p-6`
- Card gap: `gap-4`

### Radius tokens

| Token | Value | Used for |
|---|---|---|
| `rounded-input` | `6px` | Text inputs, code action buttons |
| `rounded-card` (16px) | `rounded-2xl` | Cards, dialogs, panels |
| `rounded-pill` | `9999px` | Pills, badges, segmented controls, pill buttons |
| `rounded-xl` | `12px` | Icon containers, small chips |
| `rounded-3xl` | `24px` | Large hero CTA blocks only |

---

## Icon Style

All icons are inline SVG — **no external icon library, no emoji in UI copy**.

- **Stroke weight:** 1.75px standard; 1.5px for small contexts (≤14px)
- **Cap/join:** `strokeLinecap="round" strokeLinejoin="round"` — always
- **Fill:** `fill="none"` for line icons; `fill="currentColor"` for solid icons
- **Size:** 18px standard feature icon; 14px action icon; 12px inline text icon
- **Colour:** `currentColor` — inherits from parent, never hardcoded
- Icon containers use `bg-accent-dim` (purple tint) with `text-accent` for feature card icons

---

## Voice & Tone

### Personality summary

The brand voice is a senior engineer who writes as well as they code: direct, concrete, and respectful of the reader's intelligence. No marketing fluff. No hedging. No filler.

### Core rules

| Do | Don't |
|---|---|
| Short sentences. One idea at a time. | Multi-clause run-on sentences |
| Confident declarations ("Readable turns your text into…") | Hedged language ("can help you maybe…") |
| Concrete use cases ("incident reports, ADRs, READMEs") | Vague abstractions ("all kinds of content") |
| Second person, present tense | Third person or passive voice |
| Correct technical vocabulary (Markdown, ADR, GFM, KV) | Dumbing down tech concepts |
| Specific numbers ("under 30 seconds", "30 days", "10-character ID") | Meaningless superlatives ("blazing fast") |
| "Paste. Publish. Share." | "Revolutionize your workflow" |
| Active voice | Passive voice |

### Words to never write

`Revolutionary`, `game-changing`, `disrupting`, `paradigm shift`, `all-in-one`, `end-to-end`, `seamless`, `robust`, `powerful solution`, `leverage`, `synergy`, `we're excited to announce`, `delighted to share`, `game changer`, `next-level`, `best-in-class`.

### Copy hierarchy

1. **Hero headline** — 3–8 words, declarative, names the transformation. *"Write in Markdown. Get a page worth sharing."*
2. **Sub-headline** — 1–2 sentences, names what the product does and removes the biggest objection.
3. **Trust signals** — removes friction: *"Free · No account · Published in seconds"*
4. **Eyebrow** — ultra-short, 2–3 words, uppercase. Used for section labels only.
5. **Feature headline** — benefit-first, one sentence max. *"Beautiful by default"* not *"Advanced Rendering Engine"*.
6. **Feature description** — what the user experiences, not what the code does.

---

## Key Messages

### Hero headlines (pick any)

- "Write in Markdown. Get a page worth sharing." ← **primary / canonical**
- "Markdown, made beautiful."
- "Paste once. Share a page people actually read."
- "Your writing, the way it was meant to be read."
- "Beautiful pages. Instantly."
- "The space between writing Markdown and making it readable."

### Sub-headlines / body copy

- "Readable turns your plain text into a beautifully formatted page — with proper headings, code blocks, and tables — shareable with a single link. No setup, no noise." ← **canonical subtitle**
- "No signup, no onboarding. Paste and you're in the editor."
- "Typography, spacing, and layout — handled so your content lands the way you meant it."
- "When your message gets escalated or CC'd, the structure stays intact."
- "Nothing stored until you deliberately hit publish."
- "Send in Slack, email, or a ticket. They just read."

### CTAs (verb-first, specific)

- "Open the editor — it's free" ← **primary CTA**
- "Try it now"
- "See a live example"
- "Paste your first draft"
- "Open the editor"
- "Make your own →"

### Social / short-form

- "Markdown → beautiful page → link → done."
- "Stop pasting raw Markdown into Slack. There's a better way."
- "Your incident report deserves to look like you wrote it on purpose."
- "ADRs, READMEs, post-mortems, proposals. One link. Anyone can read it."
- "The fastest way to share something that looks like you spent time on it."

---

## Use Cases (with pain and proof)

| Use case | The pain | Readable's role |
|---|---|---|
| **Incident summaries / post-mortems** | Raw MD pasted to Slack is noise; Google Docs requires an account | A link anyone can open — timeline, severity, root cause all intact |
| **Architecture decision records (ADRs)** | ADRs live in repos — non-engineers can't navigate them | A shareable link that explains the decision without GitHub |
| **README-style docs** | GitHub requires login, repo navigation, mental model overhead | A plain URL that reads like a proper document |
| **Release notes** | Buried in PRs or CHANGELOG.md | A clean page stakeholders can actually read |
| **Onboarding guides** | Google Docs for internal docs requires IT provisioning | A Readable link pasted in the welcome Slack message |
| **Proposals / briefs** | Writing in Markdown, formatting in another tool wastes time | Publish from the Markdown, skip the formatting step |
| **CI/CD via API** | Manual publishing doesn't scale | The Readable API publishes pages from pipelines automatically |

---

## Tone in Specific Contexts

### Product announcements

Lead with what changed for the user, not what changed in the code. One sentence of context, one of impact. No changelog-speak.

### Social media (LinkedIn, X/Twitter)

- Open with the pain or the scenario, not the product name
- Use line breaks aggressively — no walls of text
- End with a concrete, specific CTA
- No hashtag spam, no emoji overload, no hollow hype

### Ad copy

- Headline: name the transformation in under 8 words
- Body: remove one specific objection (no account / free / 30 seconds)
- CTA: verb-first, specific ("Try the editor free" not "Learn more")

### Email

- Subject: specific scenario, not product feature
  - ✅ "Stop pasting raw Markdown into Slack"
  - ❌ "Announcing Readable's new sharing features"
- Body: 3 paragraphs max. Problem → Solution → CTA.
- Signature: *"Built for clarity. — The Readable team"*

### Developer / technical content

- Use correct terminology (Markdown, GFM, localStorage, Cloudflare KV, API key)
- Show real code examples for API/CLI use cases
- Don't over-explain concepts the audience already knows
- Acknowledge the technical sophistication of the audience

---

## Competitive Positioning

| Tool | Why users reach for it | Why Readable wins |
|---|---|---|
| Google Docs | Rich formatting, familiar | Requires Google account; not Markdown-native |
| Notion | Beautiful output, flexible | Requires workspace access; heavy onboarding |
| GitHub Gists | Developer-native | Poor sharing-optimised rendering; no clean URL |
| HackMD / StackEdit | Markdown-native | Collaborative overkill; not optimised for sharing |
| Confluence | Enterprise docs | Requires corporate SSO; heavyweight |
| Pasting into Slack/email | Zero friction | Destroys all formatting; no permanent link |

**Readable's position:** The fastest, most beautiful path from Markdown to a link someone can actually read. Not a full tool — a sharp one.

---

## What Readable Is Not

Be explicit in all positioning to avoid misleading copy:

- **Not a CMS** — published pages are immutable snapshots, not editable posts
- **Not a collaboration tool** — no comments, no co-editing, no version history
- **Not a note-taking app** — Readable publishes notes, not stores them
- **Not permanent for anonymous users** — 30-day TTL (account unlocks permanent pages)
- **Not access-controlled** — published pages are publicly accessible to anyone with the link

---

## Always Include in Marketing Assets

1. **The zero-friction proof point** — "no account", "free", "under 30 seconds", or all three
2. **The transformation** — from (raw Markdown / technical draft) to (beautiful / shareable / readable page)
3. **At least one specific use case** — incident report, ADR, README, or post-mortem
4. **The CTA** — always link to the editor at `/app`, never to a sign-up page

---

## SEO

| Element | Value |
|---|---|
| Root `<title>` | `Readable — Share Beautiful Markdown Pages Instantly` |
| Root `<meta description>` | `Convert any Markdown into a clean, beautifully formatted shareable page in seconds. Perfect for incident reports, ADRs, READMEs, and technical docs. Free, no account required.` (155 chars) |
| Title pattern | `{Page title} — Readable` |
| Primary keywords | markdown viewer, share markdown online, markdown to html, markdown preview, shareable markdown link, incident report template, ADR template, README viewer, technical writing tool |
| Schema types | `SoftwareApplication + WebSite + WebPage` on home page |
| OG image | `/opengraph-image` — 1200×630 |
| Twitter card | `summary_large_image` |

---

## Print & Media

- Print styles force white background, black text, with code blocks wrapped
- Published pages produce clean, chrome-free PDF via `⌘P` — no ads, no nav, no cookie banners
- Dark theme-color meta: `#000000`; Light: `#ffffff`

---

*Last updated: April 2026. Contact: Ashwin Sathian — ashwinsathyan19@gmail.com*
