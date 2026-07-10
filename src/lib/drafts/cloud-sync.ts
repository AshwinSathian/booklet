"use client";

/**
 * Cloud draft sync — an observer layer on top of the synchronous, purely
 * local drafts store (./store.ts). Signed-out users are completely
 * unaffected: every exported function here is a no-op until
 * `setCloudSyncUser` has been called with a truthy userId, and nothing in
 * store.ts/AppClient's core editing path depends on this module at all.
 *
 * Design:
 *  - store.ts emits a mutation event after every create/update/delete/
 *    duplicate/publish-link. We subscribe once and debounce-push affected
 *    drafts to `PUT /api/drafts/[id]` in the background (fire-and-forget —
 *    local persistence has already happened synchronously by the time we
 *    see the event).
 *  - `pullCloudDrafts` runs once on mount for a signed-in user: fetch the
 *    cloud draft list, and for each id that exists both locally and in the
 *    cloud, keep whichever side has the later `updatedAt` and sync the
 *    other direction to match (last-write-wins — see AUDIT_REMEDIATION_PLAN.md
 *    P4-2). Drafts missing on one side are pulled/pushed as appropriate.
 *
 * Account-switch safety: a per-draft "owner" marker is kept in localStorage
 * (DRAFTS_STORAGE_KEYS.cloudOwners, draftId -> userId — never sent to the
 * server). A draft is only ever pushed to the cloud once it has been
 * created or edited *while a particular account is signed in*, which claims
 * it for that account. Pre-existing local drafts that were authored
 * anonymously (or under a different account that previously used this
 * browser) are never bulk-adopted into a newly-signed-in account — they
 * stay local-only until the user explicitly edits them while signed in.
 * This is a deliberate v1 simplification: no UI to "claim" old drafts,
 * because doing that silently would risk attributing someone else's
 * content to whoever happens to be signed in later.
 */

import { coerceDraftDoc } from "./migrate";
import {
  getDraft,
  listDrafts,
  restoreDraft,
  subscribeToDraftMutations,
  type DraftMutationEvent,
} from "./store";
import { DRAFTS_STORAGE_KEYS } from "./constants";
import type { DraftDoc, DraftMeta } from "./types";

const PUSH_DEBOUNCE_MS = 1500;

let currentUserId: string | null = null;
let unsubscribe: (() => void) | null = null;
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readOwnerMap(): Record<string, string> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(DRAFTS_STORAGE_KEYS.cloudOwners);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore malformed state; treat as empty
  }
  return {};
}

function writeOwnerMap(map: Record<string, string>): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      DRAFTS_STORAGE_KEYS.cloudOwners,
      JSON.stringify(map),
    );
  } catch {
    // best-effort bookkeeping only
  }
}

function getOwner(id: string): string | null {
  return readOwnerMap()[id] ?? null;
}

function claim(id: string, userId: string): void {
  const map = readOwnerMap();
  if (map[id] === userId) return;
  map[id] = userId;
  writeOwnerMap(map);
}

function unclaim(id: string): void {
  const map = readOwnerMap();
  if (!(id in map)) return;
  delete map[id];
  writeOwnerMap(map);
}

async function pushDraft(draft: DraftDoc): Promise<void> {
  try {
    await fetch(`/api/drafts/${draft.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
      keepalive: true,
    });
  } catch {
    // Best-effort background sync; local storage remains the source of
    // truth for the running session regardless of network state.
  }
}

function schedulePush(draft: DraftDoc): void {
  const existing = pushTimers.get(draft.id);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pushTimers.delete(draft.id);
    void pushDraft(draft);
  }, PUSH_DEBOUNCE_MS);
  pushTimers.set(draft.id, timer);
}

function scheduleDelete(id: string): void {
  const existing = pushTimers.get(id);
  if (existing) {
    clearTimeout(existing);
    pushTimers.delete(id);
  }
  void fetch(`/api/drafts/${id}`, { method: "DELETE", keepalive: true }).catch(
    () => {},
  );
}

function handleMutation(event: DraftMutationEvent): void {
  // Anonymous session: no bookkeeping, no network calls whatsoever.
  if (!currentUserId) return;

  if (event.type === "delete") {
    const owner = getOwner(event.id);
    unclaim(event.id);
    if (owner !== currentUserId) return; // never synced under this account
    scheduleDelete(event.id);
    return;
  }

  const owner = getOwner(event.draft.id);
  if (owner && owner !== currentUserId) {
    // This draft was previously claimed by a different account that used
    // this browser. Never silently re-attribute it to whoever is signed in
    // now.
    return;
  }

  claim(event.draft.id, currentUserId);
  schedulePush(event.draft);
}

function ensureSubscribed(): void {
  if (unsubscribe) return;
  unsubscribe = subscribeToDraftMutations(handleMutation);
}

/**
 * Tell the sync layer which account (if any) is currently signed in.
 * Call with `null` on sign-out / before Clerk has resolved. Anonymous
 * sessions should simply never call this with a truthy id — no other
 * gating is required.
 */
export function setCloudSyncUser(userId: string | null): void {
  currentUserId = userId && userId.trim() ? userId : null;
  if (currentUserId) ensureSubscribed();
}

export type DraftSyncDirection = "pull" | "push" | "noop";

/**
 * Pure last-write-wins decision: given a draft's local `updatedAt` (or null
 * if it doesn't exist locally) and its cloud `updatedAt`, which direction
 * should reconciliation copy data? Extracted as a standalone pure function
 * (no localStorage/fetch) so the core algorithm is unit-testable without a
 * browser environment — see tests/unit/drafts-sync.spec.ts.
 */
export function decideDraftSyncDirection(
  localUpdatedAt: string | null,
  cloudUpdatedAt: string,
): DraftSyncDirection {
  if (!localUpdatedAt) return "pull";
  if (localUpdatedAt > cloudUpdatedAt) return "push";
  if (localUpdatedAt < cloudUpdatedAt) return "pull";
  return "noop";
}

async function fetchCloudDraft(id: string): Promise<DraftDoc | null> {
  try {
    const res = await fetch(`/api/drafts/${id}`, { method: "GET" });
    if (!res.ok) return null;
    const data = (await res.json()) as { draft?: unknown };
    return coerceDraftDoc(data.draft);
  } catch {
    return null;
  }
}

/**
 * One-shot reconciliation, called once on mount for a signed-in user.
 * Last-write-wins by `updatedAt`: whichever side is newer for a given
 * draft id is copied to the other side. Drafts that exist on only one side
 * are pulled/pushed, subject to the account-claim rule above.
 */
export async function pullCloudDrafts(userId: string): Promise<void> {
  if (!userId || !userId.trim()) return;
  setCloudSyncUser(userId);

  let cloudMetas: DraftMeta[] = [];
  try {
    const res = await fetch("/api/drafts", { method: "GET" });
    if (!res.ok) return;
    const data = (await res.json()) as { drafts?: DraftMeta[] };
    cloudMetas = Array.isArray(data.drafts) ? data.drafts : [];
  } catch {
    // Offline or transient failure — local store is fully usable on its own.
    return;
  }

  const cloudIds = new Set(cloudMetas.map((m) => m.id));

  for (const meta of cloudMetas) {
    const owner = getOwner(meta.id);
    if (owner && owner !== userId) continue; // claimed by a different account locally

    const local = getDraft(meta.id);
    const direction = decideDraftSyncDirection(
      local?.updatedAt ?? null,
      meta.updatedAt,
    );

    if (direction === "pull") {
      const full = await fetchCloudDraft(meta.id);
      if (!full) continue;
      restoreDraft(full);
      claim(meta.id, userId);
    } else if (direction === "push" && local) {
      claim(meta.id, userId);
      void pushDraft(local);
    } else {
      claim(meta.id, userId);
    }
  }

  // Local drafts this account already owns but the cloud doesn't have yet
  // (created/edited offline, or newly claimed this session before any pull
  // ran) — push them up. Anonymous/unclaimed local drafts are left alone.
  for (const meta of listDrafts()) {
    if (cloudIds.has(meta.id)) continue;
    if (getOwner(meta.id) !== userId) continue;

    const full = getDraft(meta.id);
    if (full) void pushDraft(full);
  }
}
