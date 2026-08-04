import { test, expect } from "@playwright/test";
import { detectSlashTrigger } from "@/components/app/SlashMenu";
import { detectWikilinkTrigger, resolveSlashTrigger } from "@/components/app/PasteInput";

test.describe("detectSlashTrigger", () => {
  test("triggers at the very start of the document", () => {
    expect(detectSlashTrigger("/", 1)).toEqual({ start: 0, query: "" });
  });

  test("triggers at the start of a new line", () => {
    const value = "first line\n/head";
    expect(detectSlashTrigger(value, value.length)).toEqual({ start: 11, query: "head" });
  });

  test("triggers after a space", () => {
    const value = "some text /tab";
    expect(detectSlashTrigger(value, value.length)).toEqual({ start: 10, query: "tab" });
  });

  test("does NOT trigger mid-word (e.g. a fraction like km/h)", () => {
    const value = "the speed is 60km/h";
    expect(detectSlashTrigger(value, value.length)).toBeNull();
  });

  test("does NOT trigger once a space follows the slash (abandoned)", () => {
    const value = "/foo bar";
    expect(detectSlashTrigger(value, value.length)).toBeNull();
  });

  test("does NOT trigger once a newline follows the slash", () => {
    const value = "/foo\nbar";
    expect(detectSlashTrigger(value, value.length)).toBeNull();
  });

  test("does NOT trigger with no slash typed at all", () => {
    expect(detectSlashTrigger("no slash here", 5)).toBeNull();
  });

  test("re-triggers on a second slash later in the same line, abandoning the first", () => {
    const value = "/one /two";
    expect(detectSlashTrigger(value, value.length)).toEqual({ start: 5, query: "two" });
  });
});

// Regression coverage: detectWikilinkTrigger and detectSlashTrigger are NOT
// mutually exclusive by construction — detectWikilinkTrigger allows spaces
// inside its query, and detectSlashTrigger only requires the "/" be preceded
// by whitespace, so a string like "[[Notes /draft" makes both fire at once.
// PasteInput.tsx's resolveSlashTrigger is the app-level guard that keeps the
// two popups mutually exclusive by always preferring an open wikilink
// trigger. See PasteInput.tsx's resolveSlashTrigger docstring for the full
// reasoning.
test.describe("wikilink/slash mutual exclusivity", () => {
  test("both detectWikilinkTrigger and detectSlashTrigger independently fire on '[[Notes /draft' (the bug's root cause)", () => {
    const value = "[[Notes /draft";
    const caret = value.length;

    expect(detectWikilinkTrigger(value, caret)).toEqual({ start: 0, query: "Notes /draft" });
    expect(detectSlashTrigger(value, caret)).toEqual({ start: 8, query: "draft" });
  });

  test("resolveSlashTrigger suppresses the slash trigger when a wikilink trigger is open", () => {
    const value = "[[Notes /draft";
    const caret = value.length;
    const wikilink = detectWikilinkTrigger(value, caret);

    expect(wikilink).not.toBeNull();
    expect(resolveSlashTrigger(value, caret, false, wikilink)).toBeNull();
  });

  test("resolveSlashTrigger still opens normally when no wikilink trigger is open", () => {
    const value = "some text /tab";
    const caret = value.length;

    expect(detectWikilinkTrigger(value, caret)).toBeNull();
    expect(resolveSlashTrigger(value, caret, false, null)).toEqual({ start: 10, query: "tab" });
  });

  test("resolveSlashTrigger suppresses the slash trigger while there is a non-collapsed selection, even without a wikilink trigger", () => {
    const value = "some text /tab";
    expect(resolveSlashTrigger(value, value.length, true, null)).toBeNull();
  });

  test("closing the wikilink trigger (e.g. typing ']') lets the slash trigger open again", () => {
    // Once the wikilink run closes, detectWikilinkTrigger no longer fires,
    // so resolveSlashTrigger falls through to the normal slash detection —
    // proving the guard doesn't permanently wedge the slash menu shut.
    const value = "[[Notes]] /draft";
    const caret = value.length;

    expect(detectWikilinkTrigger(value, caret)).toBeNull();
    expect(resolveSlashTrigger(value, caret, false, null)).toEqual({ start: 10, query: "draft" });
  });
});
