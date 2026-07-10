# Feature scope: "subscribe to updates" on published pages

Descoped from this round (no transactional-email service/credentials
available in this environment) — documented per product decision. Part of
P4-6 in `AUDIT_REMEDIATION_PLAN.md`: "a tasteful 'Made with Readable'
attribution chip on free pages, plus lightweight author identity + 'subscribe
to updates' on published pages."

## What's already shipped (don't re-build)

- The attribution chip ("Made with Readable" colophon footer) already
  existed, and this round fixed a real bug where it ignored
  `remove_attribution_badge` and rendered unconditionally — see the commit
  fixing `src/app/p/[id]/page.tsx`'s footer.
- Author identity already exists: `src/app/p/[id]/page.tsx` links an
  `author` frontmatter field to `/u/${userId}`, a real author profile route
  (`src/app/u/[id]/`), shipped in an earlier session (`feat(share): ...
  author profile link`).

## What's missing: "subscribe to updates"

No email-sending dependency exists anywhere in this codebase (checked
`package.json` for Resend/SendGrid/Postmark/nodemailer/SES — zero matches).
`PLAN.md`'s mention of "invite via JWT+Resend" for team invites is itself
stale/aspirational — the actual invite flow (`src/lib/invite-token.ts`,
`src/app/api/teams/[id]/invite/route.ts`) only signs a JWT for a copyable
link; nothing in this codebase currently sends an email.

## What it would take

1. **Email service**: an account + API key for a transactional email
   provider (Resend is the natural choice given `PLAN.md`'s existing,
   if unimplemented, intent — low-friction API, generous free tier).
   Needs `RESEND_API_KEY` (or equivalent) as an env var, plus a verified
   sending domain.
2. **Subscription capture**: a new small collection (e.g.
   `page_subscribers`, keyed by `page_id` + email, with a double-opt-in
   confirmation token) and a `POST /api/pages/[id]/subscribe` endpoint.
   Needs the same abuse-containment treatment as everything else in this
   round: rate limiting (`src/lib/rate-limit.ts`) and probably a lightweight
   bot check (the audit's own note elsewhere about a Turnstile challenge
   above a low threshold applies here too — a public "enter your email"
   form on every published page is a spam-signup target).
3. **Double opt-in + unsubscribe**: required for basic email deliverability
   and compliance (CAN-SPAM/GDPR) — a confirm-subscription email, and an
   unsubscribe link/token in every notification sent. This is a real
   compliance surface, not optional plumbing — underbuilding it risks the
   sending domain's reputation.
4. **"Notify on republish" trigger**: hook into whatever already fires on
   page updates — `src/lib/webhook-delivery.ts`'s `deliverWebhooks(userId,
   "page.published", ...)` call sites in the publish/update routes are the
   natural place to also enqueue subscriber notification emails. Needs a
   simple digest/dedup strategy (don't email on every micro-edit — maybe
   only on genuinely new content, or a rate-limited "at most once per N
   hours" digest) to avoid becoming spammy for authors who autosave
   frequently.
5. **UI**: a subscribe form component on the published page (near the
   existing colophon/attribution footer or the `Reactions`/`ShareButtons`
   area in `src/app/p/[id]/page.tsx`), gated behind `isPublic` the same way
   `Reactions`/`ShareButtons` already are — this only makes sense for
   pages meant to be discovered/followed, not private/unlisted links.

## Why this wasn't attempted this round

No email-service account/credentials were available in this environment,
and this feature has real compliance obligations (opt-in, unsubscribe) that
shouldn't be half-built. Recommend tackling it as its own focused session
once an email-provider account is provisioned.
