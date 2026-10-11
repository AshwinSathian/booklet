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
 *  - default: the site's own paper-and-ink palette (also the safe fallback).
 *  - verdant / ember: distinct colour-accent variations (cool green, warm
 *    terracotta) that keep the accent role strictly action/link-only — no
 *    theme repurposes its accent as a decorative wash.
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
    name: "Typeset",
    description: "The default Booklet palette: paper and ink, the same as the site.",
    swatch: "#16150f",
    dark: {
      "--color-bg": "#121110",
      "--color-bg-soft": "#171614",
      "--color-bg-elevated": "#1b1a18",
      "--color-text-primary": "#f4f1ea",
      "--color-text-secondary": "#c9c5ba",
      "--color-text-muted": "#a5a195",
      "--color-accent": "#f4f1ea",
      "--color-accent-hover": "#d9d5cb",
      "--color-accent-soft": "#f4f1ea",
      "--color-accent-dim": "rgba(244, 241, 234, 0.09)",
      "--color-border-strong": "rgba(244, 241, 234, 0.20)",
      "--color-border-default": "rgba(244, 241, 234, 0.12)",
      "--color-border-subtle": "rgba(244, 241, 234, 0.07)",
      "--color-fill-1": "rgba(244, 241, 234, 0.04)",
      "--color-fill-2": "rgba(244, 241, 234, 0.08)",
      "--color-fill-3": "rgba(244, 241, 234, 0.13)",
    },
    light: {
      "--color-bg": "#fbfaf7",
      "--color-bg-soft": "#f3f1eb",
      "--color-bg-elevated": "#ffffff",
      "--color-text-primary": "#16150f",
      "--color-text-secondary": "#45433b",
      "--color-text-muted": "#66635a",
      "--color-accent": "#16150f",
      "--color-accent-hover": "#33312a",
      "--color-accent-soft": "#16150f",
      "--color-accent-dim": "rgba(22, 21, 15, 0.07)",
      "--color-border-strong": "rgba(22, 21, 15, 0.22)",
      "--color-border-default": "rgba(22, 21, 15, 0.13)",
      "--color-border-subtle": "rgba(22, 21, 15, 0.07)",
      "--color-fill-1": "rgba(22, 21, 15, 0.03)",
      "--color-fill-2": "rgba(22, 21, 15, 0.06)",
      "--color-fill-3": "rgba(22, 21, 15, 0.10)",
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
      "--color-text-secondary": "#c5c5c7",
      "--color-text-muted": "#9e9ea0",
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
      "--color-text-secondary": "#3f3f41",
      "--color-text-muted": "#5a5a5d",
      "--color-accent": "#136742",
      "--color-accent-hover": "#105939",
      "--color-accent-soft": "#276348",
      "--color-accent-dim": "rgba(19, 103, 66, 0.1)",
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
    swatch: "#e68b5f",
    dark: {
      "--color-bg": "#14100d",
      "--color-bg-soft": "#1c1613",
      "--color-bg-elevated": "#241d18",
      "--color-text-primary": "#f2e9df",
      "--color-text-secondary": "#cbc1b8",
      "--color-text-muted": "#aba198",
      "--color-accent": "#e68b5f",
      "--color-accent-hover": "#c67852",
      "--color-accent-soft": "#f0a074",
      "--color-accent-dim": "rgba(230, 139, 95, 0.14)",
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
      "--color-text-secondary": "#473d32",
      "--color-text-muted": "#5e5449",
      "--color-accent": "#8f4017",
      "--color-accent-hover": "#7b3714",
      "--color-accent-soft": "#7c4928",
      "--color-accent-dim": "rgba(143, 64, 23, 0.1)",
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
    swatch: "#7eadf9",
    dark: {
      "--color-bg": "#000000",
      "--color-bg-soft": "#000000",
      "--color-bg-elevated": "#0a0a0a",
      "--color-text-primary": "#ffffff",
      "--color-text-secondary": "#d5d5d5",
      "--color-text-muted": "#b3b3b3",
      "--color-accent": "#7eadf9",
      "--color-accent-hover": "#6c95d6",
      "--color-accent-soft": "#93c5fd",
      "--color-accent-dim": "rgba(126, 173, 249, 0.16)",
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
      "--color-text-secondary": "#1c1c1c",
      "--color-text-muted": "#333333",
      "--color-accent": "#1b49cb",
      "--color-accent-hover": "#173faf",
      "--color-accent-soft": "#325682",
      "--color-accent-dim": "rgba(27, 73, 203, 0.12)",
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
    swatch: "#8293ab",
    dark: {
      "--color-bg": "#000000",
      "--color-bg-soft": "#0a0a0a",
      "--color-bg-elevated": "#131313",
      "--color-text-primary": "#e4e4e7",
      "--color-text-secondary": "#b7b7ba",
      "--color-text-muted": "#939396",
      "--color-accent": "#8293ab",
      "--color-accent-hover": "#707e93",
      "--color-accent-soft": "#a3b1c4",
      "--color-accent-dim": "rgba(130, 147, 171, 0.12)",
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
      "--color-text-secondary": "#333337",
      "--color-text-muted": "#4a4a4e",
      "--color-accent": "#404c62",
      "--color-accent-hover": "#374154",
      "--color-accent-soft": "#424b5d",
      "--color-accent-dim": "rgba(64, 76, 98, 0.1)",
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
 * `.theme-{id}`: the light tokens by default, and the dark tokens when the
 * surrounding `html` element carries the `.dark` class (see globals.css:
 * :root is light, html.dark overrides).
 *
 * Every value written into this string comes from the fixed `THEMES` array
 * above — never from request input — so this is safe to render verbatim
 * inside a <style> element.
 */
export function themeStyleTagContent(theme: Theme): string {
  const scope = themeScopeClass(theme);
  return `.${scope}{${tokensToDeclarations(theme.light)}} html.dark .${scope}{${tokensToDeclarations(theme.dark)}}`;
}
