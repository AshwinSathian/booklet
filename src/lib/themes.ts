/**
 * Curated CSS themes for published pages (P4-4 — see PLAN.md's audit-remediation
 * note; the working punch-list this cites, AUDIT_REMEDIATION_PLAN.md, was deleted
 * once its items were resolved).
 *
 * Deliberately NOT a plugin runtime and NOT arbitrary user CSS — a theme is a
 * fixed, developer-authored set of CSS custom-property overrides, scoped to a
 * wrapper class on the published page. This mirrors the token system already
 * defined in src/app/globals.css (--color-bg, --color-accent, etc.), so a
 * theme can only ever repaint using the exact same variables the app already
 * trusts, never inject new CSS or markup. An unrecognized/tampered theme id
 * (e.g. an old doc, or a hand-edited API payload) always falls back to
 * DEFAULT_THEME_ID via getTheme() — it can never fail to resolve.
 *
 * Follows the same optional-with-safe-default convention as
 * DocSettings.typeface in src/lib/blocks.ts: `theme` is optional on
 * DocSettings, a missing value means "default", and every lookup goes
 * through getTheme() rather than indexing the THEMES array directly.
 */

/** The CSS custom properties a theme is allowed to override. Anything not
 *  listed here (radii, motion, shadows, --color-accent-warm, app-chrome-only
 *  tokens like --color-bg-glass) is intentionally out of scope — themes
 *  restyle the reading surface, not the whole design system. */
export type ThemeTokens = {
  "--color-bg": string;
  "--color-bg-soft": string;
  "--color-bg-elevated": string;
  "--color-text-primary": string;
  "--color-text-secondary": string;
  "--color-text-muted": string;
  "--color-accent": string;
  "--color-accent-hover": string;
  "--color-accent-soft": string;
  "--color-accent-dim": string;
  "--color-border-strong": string;
  "--color-border-default": string;
  "--color-border-subtle": string;
  "--color-fill-1": string;
  "--color-fill-2": string;
  "--color-fill-3": string;
};

export const THEME_TOKEN_KEYS = [
  "--color-bg",
  "--color-bg-soft",
  "--color-bg-elevated",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-muted",
  "--color-accent",
  "--color-accent-hover",
  "--color-accent-soft",
  "--color-accent-dim",
  "--color-border-strong",
  "--color-border-default",
  "--color-border-subtle",
  "--color-fill-1",
  "--color-fill-2",
  "--color-fill-3",
] as const satisfies readonly (keyof ThemeTokens)[];

export type Theme = {
  id: string;
  name: string;
  /** One-line description shown in the picker UI (also used as its title/tooltip). */
  description: string;
  /** Representative accent swatch for the picker UI — always the `dark.--color-accent` value. */
  swatch: string;
  dark: ThemeTokens;
  light: ThemeTokens;
};

export const DEFAULT_THEME_ID = "default";

/**
 * Curated set — intentionally small (5, not dozens). Each theme is a
 * coherent, tasteful variation on the existing token system:
 *  - default: the current Readable palette, unchanged (also the safe fallback).
 *  - verdant / ember: distinct colour-accent variations (cool green, warm
 *    terracotta) that keep the accent role strictly action/link-only, per
 *    BRAND.md's "purple = action only" principle generalized to "accent =
 *    action only" — no theme repurposes its accent as a decorative wash.
 *  - contrast: an accessibility-forward option — pure black/white extremes,
 *    heavier borders, an accent hue chosen for strong contrast against both
 *    the page background and the hardcoded white button label.
 *  - noir: leans further into the dark/pure-black aesthetic than the
 *    default — even its light mode trades pure white for a smoky, moodier
 *    grey, with a desaturated steel-blue accent.
 */
export const THEMES: Theme[] = [
  {
    id: "default",
    name: "Signature",
    description: "The default Readable palette — violet accent, pure-black dark mode, Apple-white light mode.",
    swatch: "#7255e8",
    dark: {
      "--color-bg": "#000000",
      "--color-bg-soft": "#0d0d0d",
      "--color-bg-elevated": "#161617",
      "--color-text-primary": "#f5f5f7",
      "--color-text-secondary": "#98989f",
      "--color-text-muted": "#7f7f82",
      "--color-accent": "#7255e8",
      "--color-accent-hover": "#6b48f0",
      "--color-accent-soft": "#a78bfa",
      "--color-accent-dim": "rgba(124, 92, 252, 0.12)",
      "--color-border-strong": "rgba(255, 255, 255, 0.16)",
      "--color-border-default": "rgba(255, 255, 255, 0.09)",
      "--color-border-subtle": "rgba(255, 255, 255, 0.05)",
      "--color-fill-1": "rgba(255, 255, 255, 0.04)",
      "--color-fill-2": "rgba(255, 255, 255, 0.08)",
      "--color-fill-3": "rgba(255, 255, 255, 0.13)",
    },
    light: {
      "--color-bg": "#ffffff",
      "--color-bg-soft": "#f5f5f7",
      "--color-bg-elevated": "#e8e8ed",
      "--color-text-primary": "#1d1d1f",
      "--color-text-secondary": "#6e6e73",
      "--color-text-muted": "#66666a",
      "--color-accent": "#6741f0",
      "--color-accent-hover": "#5530de",
      "--color-accent-soft": "#8b6cf7",
      "--color-accent-dim": "rgba(103, 65, 240, 0.10)",
      "--color-border-strong": "rgba(0, 0, 0, 0.14)",
      "--color-border-default": "rgba(0, 0, 0, 0.09)",
      "--color-border-subtle": "rgba(0, 0, 0, 0.05)",
      "--color-fill-1": "rgba(0, 0, 0, 0.03)",
      "--color-fill-2": "rgba(0, 0, 0, 0.06)",
      "--color-fill-3": "rgba(0, 0, 0, 0.10)",
    },
  },
  {
    id: "verdant",
    name: "Verdant",
    description: "A cool emerald accent in place of violet — same surfaces, same rhythm, calmer.",
    swatch: "#22b573",
    dark: {
      "--color-bg": "#000000",
      "--color-bg-soft": "#0d0d0d",
      "--color-bg-elevated": "#161617",
      "--color-text-primary": "#f5f5f7",
      "--color-text-secondary": "#98989f",
      "--color-text-muted": "#7f7f82",
      "--color-accent": "#22b573",
      "--color-accent-hover": "#1c9760",
      "--color-accent-soft": "#6fdba0",
      "--color-accent-dim": "rgba(34, 181, 115, 0.14)",
      "--color-border-strong": "rgba(255, 255, 255, 0.16)",
      "--color-border-default": "rgba(255, 255, 255, 0.09)",
      "--color-border-subtle": "rgba(255, 255, 255, 0.05)",
      "--color-fill-1": "rgba(255, 255, 255, 0.04)",
      "--color-fill-2": "rgba(255, 255, 255, 0.08)",
      "--color-fill-3": "rgba(255, 255, 255, 0.13)",
    },
    light: {
      "--color-bg": "#ffffff",
      "--color-bg-soft": "#f5f5f7",
      "--color-bg-elevated": "#e8e8ed",
      "--color-text-primary": "#1d1d1f",
      "--color-text-secondary": "#6e6e73",
      "--color-text-muted": "#66666a",
      "--color-accent": "#1a8f5b",
      "--color-accent-hover": "#146f47",
      "--color-accent-soft": "#4bbf8a",
      "--color-accent-dim": "rgba(26, 143, 91, 0.10)",
      "--color-border-strong": "rgba(0, 0, 0, 0.14)",
      "--color-border-default": "rgba(0, 0, 0, 0.09)",
      "--color-border-subtle": "rgba(0, 0, 0, 0.05)",
      "--color-fill-1": "rgba(0, 0, 0, 0.03)",
      "--color-fill-2": "rgba(0, 0, 0, 0.06)",
      "--color-fill-3": "rgba(0, 0, 0, 0.10)",
    },
  },
  {
    id: "ember",
    name: "Ember",
    description: "Warm terracotta accent on paper-cream and charcoal — an editorial, essay-like feel.",
    swatch: "#e0713c",
    dark: {
      "--color-bg": "#14100d",
      "--color-bg-soft": "#1c1613",
      "--color-bg-elevated": "#241d18",
      "--color-text-primary": "#f2e9df",
      "--color-text-secondary": "#b8a99b",
      "--color-text-muted": "#8a7c70",
      "--color-accent": "#e0713c",
      "--color-accent-hover": "#c85f2d",
      "--color-accent-soft": "#f0a074",
      "--color-accent-dim": "rgba(224, 113, 60, 0.14)",
      "--color-border-strong": "rgba(255, 232, 214, 0.16)",
      "--color-border-default": "rgba(255, 232, 214, 0.09)",
      "--color-border-subtle": "rgba(255, 232, 214, 0.05)",
      "--color-fill-1": "rgba(255, 232, 214, 0.04)",
      "--color-fill-2": "rgba(255, 232, 214, 0.08)",
      "--color-fill-3": "rgba(255, 232, 214, 0.13)",
    },
    light: {
      "--color-bg": "#faf5ec",
      "--color-bg-soft": "#f3ead9",
      "--color-bg-elevated": "#ece0cb",
      "--color-text-primary": "#2b2116",
      "--color-text-secondary": "#6b5c4c",
      "--color-text-muted": "#8a7c6c",
      "--color-accent": "#c1571f",
      "--color-accent-hover": "#a44819",
      "--color-accent-soft": "#dd8348",
      "--color-accent-dim": "rgba(193, 87, 31, 0.10)",
      "--color-border-strong": "rgba(43, 33, 22, 0.14)",
      "--color-border-default": "rgba(43, 33, 22, 0.09)",
      "--color-border-subtle": "rgba(43, 33, 22, 0.05)",
      "--color-fill-1": "rgba(43, 33, 22, 0.03)",
      "--color-fill-2": "rgba(43, 33, 22, 0.06)",
      "--color-fill-3": "rgba(43, 33, 22, 0.10)",
    },
  },
  {
    id: "contrast",
    name: "High Contrast",
    description: "Accessibility-forward: pure black/white extremes, heavier borders, AA/AAA-level contrast throughout.",
    swatch: "#3b82f6",
    dark: {
      "--color-bg": "#000000",
      "--color-bg-soft": "#000000",
      "--color-bg-elevated": "#0a0a0a",
      "--color-text-primary": "#ffffff",
      "--color-text-secondary": "#e0e0e0",
      "--color-text-muted": "#b3b3b3",
      "--color-accent": "#3b82f6",
      "--color-accent-hover": "#2563eb",
      "--color-accent-soft": "#93c5fd",
      "--color-accent-dim": "rgba(59, 130, 246, 0.16)",
      "--color-border-strong": "rgba(255, 255, 255, 0.30)",
      "--color-border-default": "rgba(255, 255, 255, 0.20)",
      "--color-border-subtle": "rgba(255, 255, 255, 0.12)",
      "--color-fill-1": "rgba(255, 255, 255, 0.08)",
      "--color-fill-2": "rgba(255, 255, 255, 0.14)",
      "--color-fill-3": "rgba(255, 255, 255, 0.22)",
    },
    light: {
      "--color-bg": "#ffffff",
      "--color-bg-soft": "#ffffff",
      "--color-bg-elevated": "#f2f2f2",
      "--color-text-primary": "#000000",
      "--color-text-secondary": "#1a1a1a",
      "--color-text-muted": "#333333",
      "--color-accent": "#1d4ed8",
      "--color-accent-hover": "#1e40af",
      "--color-accent-soft": "#60a5fa",
      "--color-accent-dim": "rgba(29, 78, 216, 0.12)",
      "--color-border-strong": "rgba(0, 0, 0, 0.35)",
      "--color-border-default": "rgba(0, 0, 0, 0.22)",
      "--color-border-subtle": "rgba(0, 0, 0, 0.14)",
      "--color-fill-1": "rgba(0, 0, 0, 0.06)",
      "--color-fill-2": "rgba(0, 0, 0, 0.10)",
      "--color-fill-3": "rgba(0, 0, 0, 0.16)",
    },
  },
  {
    id: "noir",
    name: "Noir",
    description: "Leans further into the dark aesthetic — moody surfaces in both modes, desaturated steel-blue accent.",
    swatch: "#7d8fa8",
    dark: {
      "--color-bg": "#000000",
      "--color-bg-soft": "#0a0a0a",
      "--color-bg-elevated": "#131313",
      "--color-text-primary": "#e4e4e7",
      "--color-text-secondary": "#8b8b90",
      "--color-text-muted": "#5c5c60",
      "--color-accent": "#7d8fa8",
      "--color-accent-hover": "#6d7d94",
      "--color-accent-soft": "#a3b1c4",
      "--color-accent-dim": "rgba(125, 143, 168, 0.12)",
      "--color-border-strong": "rgba(255, 255, 255, 0.12)",
      "--color-border-default": "rgba(255, 255, 255, 0.07)",
      "--color-border-subtle": "rgba(255, 255, 255, 0.04)",
      "--color-fill-1": "rgba(255, 255, 255, 0.03)",
      "--color-fill-2": "rgba(255, 255, 255, 0.06)",
      "--color-fill-3": "rgba(255, 255, 255, 0.10)",
    },
    light: {
      "--color-bg": "#e9e9ea",
      "--color-bg-soft": "#dedee0",
      "--color-bg-elevated": "#d2d2d5",
      "--color-text-primary": "#17171a",
      "--color-text-secondary": "#4d4d52",
      "--color-text-muted": "#74747a",
      "--color-accent": "#46536a",
      "--color-accent-hover": "#384357",
      "--color-accent-soft": "#6b7996",
      "--color-accent-dim": "rgba(70, 83, 106, 0.10)",
      "--color-border-strong": "rgba(0, 0, 0, 0.16)",
      "--color-border-default": "rgba(0, 0, 0, 0.10)",
      "--color-border-subtle": "rgba(0, 0, 0, 0.05)",
      "--color-fill-1": "rgba(0, 0, 0, 0.04)",
      "--color-fill-2": "rgba(0, 0, 0, 0.07)",
      "--color-fill-3": "rgba(0, 0, 0, 0.11)",
    },
  },
];

const THEMES_BY_ID: ReadonlyMap<string, Theme> = new Map(THEMES.map((t) => [t.id, t]));

/** The default theme — also the safe fallback for any unrecognized id. */
export const DEFAULT_THEME: Theme = THEMES_BY_ID.get(DEFAULT_THEME_ID)!;

/**
 * Resolve a stored (possibly missing, unknown, or tampered) theme id to a
 * Theme, always falling back to DEFAULT_THEME. This is the only place theme
 * ids should be looked up — never index THEMES/a map directly from a
 * stored/user-controlled value.
 */
export function getTheme(id: string | undefined | null): Theme {
  if (!id) return DEFAULT_THEME;
  return THEMES_BY_ID.get(id) ?? DEFAULT_THEME;
}

/** CSS class applied to a theme's scope wrapper — always derived from a
 *  resolved Theme's id (never a raw stored string), so this is safe to use
 *  directly in a className. */
export function themeScopeClass(theme: Theme): string {
  return `theme-${theme.id}`;
}

function tokensToDeclarations(tokens: ThemeTokens): string {
  return THEME_TOKEN_KEYS.map((key) => `${key}:${tokens[key]};`).join("");
}

/**
 * Build the <style> tag body that scopes a theme's token overrides to
 * `.theme-{id}`, with a light-mode override block for when the surrounding
 * `html` element carries the `.light` class (see globals.css's dark-first
 * strategy: :root is dark, html.light overrides to light).
 *
 * Every value written into this string comes from the fixed `THEMES` array
 * above — never from request input — so this is safe to render verbatim
 * inside a <style> element.
 */
export function themeStyleTagContent(theme: Theme): string {
  const scope = themeScopeClass(theme);
  return `.${scope}{${tokensToDeclarations(theme.dark)}} html.light .${scope}{${tokensToDeclarations(theme.light)}}`;
}
