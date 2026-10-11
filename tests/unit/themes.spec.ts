import { test, expect } from "@playwright/test";
import { DEFAULT_THEME, DEFAULT_THEME_ID, THEME_TOKEN_KEYS, THEMES, getTheme, themeScopeClass, themeStyleTagContent } from "@/lib/themes";

// Regression coverage for the curated CSS themes gallery (P4-4): themes are
// a fixed, developer-authored set of CSS custom-property overrides — never
// arbitrary user CSS — so an unknown/tampered theme id must always resolve
// safely rather than crash or inject anything.

test.describe("themes", () => {
  test("every theme defines every required token, in both dark and light", () => {
    for (const theme of THEMES) {
      for (const key of THEME_TOKEN_KEYS) {
        expect(theme.dark[key], `${theme.id}.dark.${key}`).toBeTruthy();
        expect(theme.light[key], `${theme.id}.light.${key}`).toBeTruthy();
      }
    }
  });

  test("theme ids are unique", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("getTheme resolves an unknown id to the default theme", () => {
    expect(getTheme("not-a-real-theme").id).toBe(DEFAULT_THEME_ID);
    expect(getTheme(undefined).id).toBe(DEFAULT_THEME_ID);
    expect(getTheme(null).id).toBe(DEFAULT_THEME_ID);
    expect(getTheme("")).toBe(DEFAULT_THEME);
  });

  test("getTheme resolves a known id to that exact theme", () => {
    const verdant = THEMES.find((t) => t.id === "verdant");
    expect(verdant).toBeTruthy();
    expect(getTheme("verdant")).toBe(verdant);
  });

  test("default theme's tokens match globals.css's actual current values", () => {
    // Guards against the two silently drifting apart — see src/app/globals.css
    // for the source values (DARK / LIGHT root token blocks).
    expect(DEFAULT_THEME.dark["--color-bg"]).toBe("#121110");
    expect(DEFAULT_THEME.dark["--color-accent"]).toBe("#f4f1ea");
    expect(DEFAULT_THEME.dark["--color-text-muted"]).toBe("#a5a195");
    expect(DEFAULT_THEME.light["--color-bg"]).toBe("#fbfaf7");
    expect(DEFAULT_THEME.light["--color-accent"]).toBe("#16150f");
    expect(DEFAULT_THEME.light["--color-text-muted"]).toBe("#66635a");
  });

  test("themeScopeClass is derived from the resolved theme's id", () => {
    expect(themeScopeClass(getTheme("noir"))).toBe("theme-noir");
    expect(themeScopeClass(getTheme("tampered-value"))).toBe(`theme-${DEFAULT_THEME_ID}`);
  });

  test("themeStyleTagContent never contains anything beyond the fixed token set", () => {
    for (const theme of THEMES) {
      const css = themeStyleTagContent(theme);
      // Light is the base, so a page read without JavaScript (no class on
      // <html>) matches the light site around it.
      expect(css.startsWith(`.theme-${theme.id}{${"--color-bg"}:${theme.light["--color-bg"]};`)).toBe(true);
      expect(css).toContain(`html.dark .theme-${theme.id}{`);
      for (const key of THEME_TOKEN_KEYS) {
        expect(css).toContain(`${key}:${theme.dark[key]};`);
      }
      // No script tags, no closing </style>, no unexpected markup — this
      // string is rendered via dangerouslySetInnerHTML into a <style> tag.
      expect(css).not.toMatch(/<\/style>|<script/i);
    }
  });
});
