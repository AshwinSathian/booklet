export const APP_NAME = "Readable";

export const ROUTES = {
  home: "/",
  app: "/app",
  publish: (id: string) => `/p/${id}`,
} as const;

export const STORAGE = {
  kvBinding: "READABLE_DOCS",
  maxInputChars: 200_000,
  maxDocBytes: 350_000, // keep KV payloads safe and fast
  ttlSeconds: 60 * 60 * 24 * 30, // 30 days (MVP-friendly default)
} as const;

export const UI = {
  previewDebounceMs: 120,
  maxCodeCollapseLines: 18,
} as const;

export const API = {
  publishPath: "/api/publish",
} as const;

export const BLOCKS = {
  version: 1,
} as const;
