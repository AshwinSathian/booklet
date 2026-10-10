export const APP_NAME = "Booklet";
// Shown as "Source" in the site footer (AGPL-3.0 section 13). If you run a
// modified copy, point this at your own source.
export const REPO_URL = "https://github.com/AshwinSathian/booklet";

export const ROUTES = {
  home: "/",
  app: "/app",
  publish: (id: string) => `/p/${id}`,
  signIn: "/sign-in",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  myPages: "/my-pages",
  account: "/settings/account",
  spaces: "/t",
  space: (slug: string) => `/t/${slug}`,
  mcpSetup: "/mcp-setup",
  integrations: "/integrations",
} as const;

export const STORAGE = {
  maxInputChars: 200_000,
  maxDocBytes: 600_000, // increased to accommodate optional raw markdown alongside blocks
} as const;

export const UI = {
  previewDebounceMs: 120,
  maxCodeCollapseLines: 18,

  /**
   * Save status smoothing to avoid flicker during fast typing.
   * These are UI-only timings; storage semantics remain unchanged.
   */
  saveStatus: {
    minShowSavingMs: 420,
    minShowSavedMs: 650,
  },

  /** Coalescing window for repeated transient actions (copy/export). */
  toastCoalesceMs: 900,

  /** File import configuration. */
  importMarkdown: {
    accept: ".md,text/markdown",
    maxFileBytes: 500_000,
    defaultTitle: "Imported draft",
  },
} as const;

export const API = {
  publishPath: "/api/publish",
} as const;

export const BLOCKS = {
  version: 1,
} as const;
