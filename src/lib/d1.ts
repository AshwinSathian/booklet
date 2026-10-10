import { getCloudflareContext } from "@opennextjs/cloudflare";

// The subset of the D1 binding the spike uses. Hand-written so the app's
// tsconfig does not need the Workers runtime types.
export type D1Result<T = Record<string, unknown>> = { results: T[]; meta: { changes: number } };
export type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
};
export type D1 = {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<D1Result[]>;
};

/**
 * The D1 binding. Unit tests run in Node, outside the Workers runtime, and
 * put a local D1 (wrangler's getPlatformProxy) on globalThis first.
 */
export function getD1(): D1 {
  const injected = (globalThis as { __BOOKLET_D1__?: D1 }).__BOOKLET_D1__;
  if (injected) return injected;
  return (getCloudflareContext().env as unknown as { DB: D1 }).DB;
}
