import { test, expect } from "@playwright/test";
import { getEditorPrefs, setEditorPrefs } from "@/lib/editor/prefs";

// getEditorPrefs/setEditorPrefs gate all persistence behind
// `typeof window !== "undefined"` / `window.localStorage` (see
// src/lib/editor/prefs.ts), the same convention as src/lib/drafts/store.ts —
// this Node-based test runner has no DOM, so `window` itself doesn't exist
// unless stubbed, consistent with tests/unit/drafts-auto-title.spec.ts.
// `localStorage` is stubbed as a bare global too (rather than only on
// `window`) so tests can read/write it directly without going through the
// module under test.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(index: number) { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, value); }
}

test.describe("editor prefs", () => {
  test.beforeEach(() => {
    const storage = new MemoryStorage();
    (globalThis as unknown as { localStorage: Storage }).localStorage = storage;
    (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
  });

  test("defaults paragraphDimming to false when nothing is stored", async () => {
    expect(getEditorPrefs().paragraphDimming).toBe(false);
  });

  test("setEditorPrefs persists and getEditorPrefs reads it back", async () => {
    setEditorPrefs({ paragraphDimming: true });
    expect(getEditorPrefs().paragraphDimming).toBe(true);
  });

  test("setEditorPrefs merges rather than replacing unrelated keys", async () => {
    setEditorPrefs({ paragraphDimming: true });
    const result = setEditorPrefs({});
    expect(result.paragraphDimming).toBe(true);
  });

  test("malformed stored JSON falls back to defaults instead of throwing", async () => {
    localStorage.setItem("booklet:editorPrefs", "{not json");
    expect(() => getEditorPrefs()).not.toThrow();
    expect(getEditorPrefs().paragraphDimming).toBe(false);
  });
});
