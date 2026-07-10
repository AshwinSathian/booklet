# Feature scope: image paste/upload + hosting

Descoped from this round (no Cloudflare R2 bucket/credentials available in
this environment) — documented here per product decision so it can be
picked up later without re-deriving the plan. This is P4-1 in
`AUDIT_REMEDIATION_PLAN.md`: "the single largest concrete feature gap versus
the closest direct competitor (JotBird), blocks the 'paste a real document'
and 'share AI output with screenshots' use cases."

## Current state

`src/lib/blocks.ts` defines the image block as `{ t: "image"; src: string;
alt: string }` — `src` is rendered as-is, external-URL-only. There is no
paste handler, no drop handler, and no upload endpoint anywhere in the
editor (`src/app/app/`, `src/components/app/`) — confirmed via grep for
`onPaste`/`clipboardData`/`DataTransfer`, zero matches.

## What it would take

1. **Storage**: an R2 bucket (or equivalent object storage — S3-compatible
   works too, but R2 is the natural choice given this app's Cloudflare
   Tunnel/prior-Workers history, see `docs/OPERATIONS.md`). Needs:
   - A bucket, a public read policy or a signed-URL-on-read pattern.
   - Credentials as env vars (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
     `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, plus a public base URL for
     serving uploaded images).
2. **Upload endpoint**: a new `POST /api/images` (or similar) accepting a
   multipart/form-data or raw-binary body, validating:
   - Auth (same anonymous/signed-in split as `/api/publish` — anonymous
     uploads need the same IP-based rate limiting and monthly-quota
     treatment as anonymous page publishes, see `src/lib/rate-limit.ts` and
     the quota enforcement added in this round).
   - File type (allowlist: png/jpg/webp/gif — reject SVG unless sanitized,
     since inline SVG can carry script content; reject anything else).
   - File size cap (something in the low single-digit MB range — check
     `STORAGE.maxDocBytes` in `src/lib/constants.ts` for the existing
     document-size convention and pick a comparable, deliberate limit for
     images).
   - Re-encode/strip EXIF metadata server-side before storing (privacy —
     photos can carry GPS coordinates) — a lightweight image library
     (`sharp` is the standard choice, though check Workers-runtime
     compatibility if this ever moves off the current PM2/Node setup per
     `docs/OPERATIONS.md`).
3. **Editor integration** (`src/app/app/AppClient.tsx` and whatever the
   actual editor input component is — see the `AppShell.tsx`/`AppClient.tsx`
   split described elsewhere in this docs folder):
   - `onPaste` handler on the editor textarea/input: detect image data in
     `clipboardData.items`, upload it, insert the resulting Markdown image
     syntax (`![alt](url)`) at the cursor position.
   - `onDrop` handler for drag-and-drop image files, same upload + insert
     flow.
   - Upload-in-progress UX: a placeholder token in the text
     (`![Uploading...]()`) swapped for the real URL once the upload
     completes, so the editor doesn't block on network round-trips.
4. **Anonymous-page image lifecycle**: per the audit's own scoping note,
   "anonymous-page images expire with the page." Given this round's
   decision to make anonymous *pages* permanent (no TTL — see the
   quota-enforcement work and `docs/OPERATIONS.md`-adjacent reasoning),
   this specific recommendation would need revisiting: if pages don't
   expire, images shouldn't need independent expiry either. The real cost
   control is the same one already applied to pages — the per-IP monthly
   publish quota bounds how much anonymous storage (docs *and* now images)
   any single actor can create. Decide at implementation time whether
   images need their own additional cap (e.g. max N images per page, max
   total image bytes per page) on top of the existing per-page document
   size cap.
5. **Publish route changes**: `src/app/api/publish/route.ts` and
   `src/app/api/v1/publish/route.ts` don't need changes for this — images
   are referenced by URL from block content, not embedded in the publish
   payload itself, so the upload endpoint and the publish flow are
   independent once an image URL exists.

## Why this wasn't attempted this round

No R2 (or other object storage) account/credentials were available in this
environment. Everything above is buildable without live credentials except
the actual upload-and-serve round trip, which needs a real bucket to test
against. Recommend tackling this as its own focused session once storage
credentials are provisioned.
