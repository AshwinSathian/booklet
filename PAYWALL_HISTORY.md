# Readable — Paywall Feature History

> **Archived record of every feature that was previously gated behind a paid plan.**
> Created: May 2026.
> Purpose: Allow complete, accurate reinstatement of any or all paywalls at a future date.
>
> All paywalls were removed in May 2026 as part of an "everything free during early access" policy.
> The billing infrastructure (Stripe, pricing page, quota.ts, UpgradeGate component) was **preserved
> in full** and can be re-enabled without rebuilding anything from scratch.

---

## Decision Record

**Why removed:** Early-access stage. No paying users yet. Paywalls create conversion friction before
the product has demonstrated enough value to justify asking for payment. The correct order is:
(1) prove retention, (2) prove users would pay, (3) enable paywalls. We are still at step 1.

**What was preserved:**
- `src/lib/quota.ts` — full plan/feature matrix. Re-enable by reverting `free` plan values.
- `src/lib/stripe.ts` — Stripe SDK client.
- `src/app/api/billing/` — checkout, webhook, and portal endpoints.
- `src/app/pricing/page.tsx` — three-tier pricing page (now shows early-access banner).
- `src/components/ui/UpgradeGate.tsx` — lock overlay component (unused in UI; ready for reinstatement).
- Stripe plan IDs and env vars remain in place.

---

## Feature Paywall Inventory

### 1. Version History (browse + restore snapshots)

| Attribute | Value |
|---|---|
| **What it does** | Shows the last 10 content snapshots for a page; allows one-click restore |
| **Previously required** | Pro plan |
| **Gate type** | UI-only (no API enforcement — the API routes were accessible to any authenticated user) |
| **Free plan behaviour** | Showed a locked `DrawerItem` in My Pages → "Available on Readable Pro" link to `/pricing` |
| **Pro plan behaviour** | Full DrawerItem linking to `/my-pages/versions/[id]` |

**Code locations to update for reinstatement:**

`src/lib/quota.ts`:
```typescript
// Revert free plan:
versionHistory: false,
```

`src/app/my-pages/MyPagesClient.tsx` — restore the ternary around the version history DrawerItem:
```tsx
{canUseFeature(userPlan, "versionHistory") ? (
  <DrawerItem icon="history" label="Version history" ... href={`/my-pages/versions/${page.id}`} />
) : (
  <DrawerItem icon="history" label="Version history"
    description="Available on Readable Pro — upgrade to access"
    href="/pricing" locked />
)}
```

---

### 2. Password Protection

| Attribute | Value |
|---|---|
| **What it does** | Sets a bcrypt-hashed password on a page; share page shows PasswordGate to unauthenticated viewers |
| **Previously required** | Pro plan |
| **Gate type** | UI gate + API enforcement |
| **Free plan behaviour** | Locked `DrawerItem` in My Pages → `/pricing`; PATCH `/api/pages/[id]` returned 403 for free users |
| **Pro plan behaviour** | Password set/remove UI in My Pages drawer; PATCH API allowed |

**Code locations to update for reinstatement:**

`src/lib/quota.ts`:
```typescript
// Revert free plan:
passwordProtection: false,
```

`src/app/api/pages/[id]/route.ts` PATCH handler — restore the plan check (lines 49–54 in original):
```typescript
if (body.password !== undefined) {
  const plan = await getUserPlan(userId);
  if (!canUseFeature(plan, "passwordProtection")) {
    return NextResponse.json({ error: "Password protection requires Readable Pro." }, { status: 403 });
  }
  // ... rest of password logic
}
```

`src/app/my-pages/MyPagesClient.tsx` — restore locked ternary around password DrawerItem (original lines 543–565).

---

### 3. Remove Attribution Badge ("Made with Readable")

| Attribute | Value |
|---|---|
| **What it does** | Suppresses the floating "Made with Readable" chip shown on share pages |
| **Previously required** | Pro plan |
| **Gate type** | Publish-time default only (the `remove_attribution_badge` boolean was set at publish to `canUseFeature(plan, "removeAttributionBadge")`) |
| **Free plan behaviour** | `remove_attribution_badge = false` → badge rendered on share page |
| **Pro plan behaviour** | `remove_attribution_badge = true` → no badge |
| **After paywall removal** | Signed-in users: `remove_attribution_badge = true` by default (no badge). Anonymous: badge still shown. Users can toggle per-page via PATCH. |

**Code locations to update for reinstatement:**

`src/lib/quota.ts`:
```typescript
// Revert free plan:
removeAttributionBadge: false,
```

`src/app/api/publish/route.ts` and `src/app/api/v1/publish/route.ts` — revert badge default logic:
```typescript
// Revert to:
const plan = await getUserPlan(userId);
remove_attribution_badge: userId ? canUseFeature(plan, "removeAttributionBadge") : false,
```

`src/app/api/pages/[id]/route.ts` PATCH — optionally remove the `remove_attribution_badge` PATCH support (or keep it Pro-gated):
```typescript
if (body.remove_attribution_badge !== undefined) {
  const plan = await getUserPlan(userId);
  if (!canUseFeature(plan, "removeAttributionBadge")) {
    return NextResponse.json({ error: "Removing the attribution badge requires Readable Pro." }, { status: 403 });
  }
  patch.remove_attribution_badge = body.remove_attribution_badge;
}
```

`src/app/my-pages/MyPagesClient.tsx` — remove or gate the "Show attribution badge" toggle DrawerItem.

---

### 4. Webhooks

| Attribute | Value |
|---|---|
| **What it does** | Fires signed HTTP POST callbacks to a configured URL on `page.published` and `page.updated` events |
| **Previously required** | Pro or Teams plan |
| **Gate type** | API enforcement only (no UI was ever built for My Pages webhook management) |
| **Free plan behaviour** | `POST /api/webhooks` returned 403 |
| **Pro/Teams behaviour** | Webhook creation, listing, deletion allowed; max 5 per user |

**Code locations to update for reinstatement:**

`src/lib/quota.ts`:
```typescript
// Revert free plan:
webhooks: false,
```

`src/app/api/webhooks/route.ts` POST handler — restore lines 37–40:
```typescript
const plan = await getUserPlan(userId);
if (!canUseFeature(plan, "webhooks")) {
  return NextResponse.json({ error: "Webhooks require Readable Pro or Teams plan." }, { status: 403 });
}
```

`src/components/my-pages/WebhooksSection.tsx` — optionally wrap the "Add webhook" button in an `<UpgradeGate feature="Webhooks" requiredPlan="pro">`.

---

### 5. API Key Count Limit

| Attribute | Value |
|---|---|
| **What it does** | Limits the number of active API keys per user |
| **Previously defined** | Free: 2, Pro: 10, Teams: unlimited |
| **Gate type** | **Quota only — was NEVER enforced in UI or API** |
| **Note** | This was a planned enforcement that was never implemented. `quota.ts` defined `apiKeysMax` but no code in `api/v1/keys/route.ts` or `ApiKeysClient.tsx` checked it. |

**Code locations to update for reinstatement (NEW enforcement required):**

`src/lib/quota.ts`:
```typescript
// Revert free plan:
apiKeysMax: 2,
```

`src/app/api/v1/keys/route.ts` POST handler — add:
```typescript
const plan = await getUserPlan(userId);
const limits = getLimits(plan);
if (limits.apiKeysMax !== -1) {
  const existing = await getApiKeysByUser(userId);
  if (existing.length >= limits.apiKeysMax) {
    return NextResponse.json(
      { error: `API key limit reached. Your plan allows ${limits.apiKeysMax} keys.` },
      { status: 422 }
    );
  }
}
```

`src/app/my-pages/ApiKeysClient.tsx` — add an `<UpgradeGate>` overlay on the "Add key" button when at limit.

---

### 6. Teams Access

| Attribute | Value |
|---|---|
| **What it does** | Allows creating team workspaces, inviting members, publishing to team spaces |
| **Previously required** | Teams plan |
| **Gate type** | Quota definition only — Teams feature was not built at time of paywall removal |
| **Note** | The feature was built as part of the May 2026 overhaul with `teamsAccess` open to all. To re-gate, add `canUseFeature(plan, "teamsAccess")` checks to team routes. |

**Code locations to update for reinstatement:**

`src/lib/quota.ts`:
```typescript
// Revert free plan:
teamsAccess: false,
```

Add `canUseFeature(plan, "teamsAccess")` checks to:
- `src/app/api/teams/route.ts` POST (create team)
- `src/app/api/teams/[id]/invite/route.ts` POST (send invite)
- `src/components/app/TeamPublishDropdown.tsx` — wrap with `<UpgradeGate feature="Team workspaces" requiredPlan="teams">`

---

## UpgradeGate Component

`src/components/ui/UpgradeGate.tsx` exists and is fully functional. It renders children greyed-out
behind a lock overlay with a link to `/pricing`. It was **never used in any page** — the MyPagesClient
implemented lock UX via a `locked` prop on the `DrawerItem` component instead.

For a clean reinstatement, prefer wrapping feature surfaces with `<UpgradeGate>` rather than restoring
the `DrawerItem locked` ternaries — it is more consistent and composable.

```tsx
// Usage pattern:
<UpgradeGate feature="Version history" requiredPlan="pro">
  <DrawerItem icon="history" label="Version history" href={`/my-pages/versions/${page.id}`} />
</UpgradeGate>
```

---

## Billing Infrastructure Status

All billing infrastructure is **fully intact and deployable**:

| Component | File | Status |
|---|---|---|
| Stripe SDK client | `src/lib/stripe.ts` | Active |
| Checkout session endpoint | `src/app/api/billing/checkout/route.ts` | Active |
| Stripe webhook handler | `src/app/api/billing/webhook/route.ts` | Active — handles plan upgrades/downgrades |
| Customer portal endpoint | `src/app/api/billing/portal/route.ts` | Active |
| Pricing page | `src/app/pricing/page.tsx` | Active — shows early-access banner |
| Plan columns on user doc | `src/lib/db/types.ts` — `DbUser` | `plan`, `stripe_customer_id`, `stripe_subscription_id`, `plan_expires_at` all present |

To re-enable billing: remove the early-access banner from `pricing/page.tsx`, add Stripe env vars to
Cloudflare Workers secrets, and re-enable the plan gates per section above.

---

*Last updated: May 2026. Contact: Ashwin Sathian — ashwinsathyan19@gmail.com*
