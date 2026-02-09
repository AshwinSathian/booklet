import { DRAFTS_STORAGE_KEYS } from "./constants";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function hasLocalStorage(): boolean {
  if (!isBrowser()) return false;
  try {
    return typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function getActiveDraftId(): string | null {
  if (!hasLocalStorage()) return null;
  try {
    const id = window.localStorage.getItem(DRAFTS_STORAGE_KEYS.activeDraftId);
    return id && id.trim() ? id : null;
  } catch {
    return null;
  }
}

export function setActiveDraftId(id: string): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(DRAFTS_STORAGE_KEYS.activeDraftId, id);
  } catch {
    // ignore
  }
}

export function clearActiveDraftId(): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(DRAFTS_STORAGE_KEYS.activeDraftId);
  } catch {
    // ignore
  }
}
