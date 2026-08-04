# Show HN draft — ready to post

> Written 2026-08-04 as part of `PLAN-ai-agent-wedge.md` Phase 4. This is a draft, not
> submitted. Show HN guidelines (verified live 2026-08-04, source:
> [HN Show guidelines](https://news.ycombinator.com/showhn.html) and community posting guides):
> titles should be neutral and close to what the thing actually does — no editorializing,
> exclamation points, or marketing language; the linked page must be something people can
> actually try, not a blog post or landing page alone; the founder posts the first comment with
> backstory and context, in their own voice, without sales language.

## Submission

- **Title:** `Show HN: Booklet – publish Markdown as a page, from your terminal, CI, or Claude`
- **URL:** https://booklet.ashwinsathian.com (the live editor — visitors can try the core loop
  with zero signup, which is what Show HN submissions need to work)

*(Alternate title, if the above reads as two products bolted together: `Show HN: Booklet – a
Markdown publisher with a CLI, REST API, and MCP server built in`. Pick one before posting —
don't submit both.)*

## First comment (post immediately after submitting, in your own voice — edit before posting)

> I built Booklet because I kept writing incident reports, ADRs, and runbooks in Markdown at
> work, then watching them turn into unreadable asterisk-soup the moment I shared them with
> someone non-technical. It's a paste-and-publish editor: paste Markdown, get a live preview,
> hit publish, get a permanent link. No account needed to try it.
>
> The part I'd actually like feedback on: underneath the editor there's a REST API, an npm CLI
> (`booklet-cli`), a GitHub Action, and an MCP server, so the same publish flow works from a CI
> pipeline, a script, or a conversation with Claude/Cursor/etc. — not just the browser. Setup for
> the AI-assistant side is at [booklet.ashwinsathian.com/mcp-setup](https://booklet.ashwinsathian.com/mcp-setup)
> if that's the part you're curious about.
>
> It's a solo, self-hosted project (no VC, no team) — genuinely interested in whether this is
> useful to anyone outside my own workflow, and where it falls over. Happy to answer anything
> about how it's built too.

*(Keep this close to the actual backstory — don't add claims about traction/users that aren't
true; HN readers check.)*

---

## Success bar — fill in before posting, not after

The point of this launch is to find out whether the "AI assistant / CI publishes your docs"
positioning has real pull, given Booklet has had essentially zero registered users and no prior
launch attempt in ~6 months of solo development. Define what "worked" means *before* posting, or
the result will be rationalized after the fact instead of read honestly.

| Metric | Baseline (pre-launch) | Target | Actual (fill in after) |
|---|---|---|---|
| New sign-ups (7 days post-launch) | 0 | `<founder fills in>` | |
| Organic anonymous publishes from non-founder IPs (7 days) | ~0 (91 total, ever, mostly the founder's own testing) | `<founder fills in>` | |
| Publishes with `source: mcp` or `source: github-action` (admin dashboard, 7 days) | 0 | `<founder fills in>` | |
| HN post reaches front page / stays visible >1hr | n/a | yes/no | |
| Any inbound GitHub issue, star increase, or direct message referencing the post | 0 | `<founder fills in>` | |

**How to check the numbers:** `/admin` (IP-restricted) already has a "Publish source — last 7
days" breakdown and an "Anonymous publish share" metric (`src/lib/db/admin-metrics.ts`) — no new
tooling needed, just check it before and after.

**What to do with the result:**
- **Clears the bar:** the wedge has real pull — worth the follow-up work in
  `PLAN-ai-agent-wedge.md`'s "Follow-up Work" section (directory submissions if not already done,
  a second, more targeted post to a specific community, revisiting homepage copy with real data
  instead of guesses).
- **Doesn't clear the bar:** treat that as real signal, not a reason to immediately try a
  different angle and relaunch — repeated relaunches without changing anything structural just
  produces more noise. Worth sitting with the result and deciding deliberately, not reflexively.
