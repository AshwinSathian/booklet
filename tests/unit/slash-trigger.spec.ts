import { test, expect } from "@playwright/test";
import { detectSlashTrigger } from "@/components/app/SlashMenu";

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
