import { getPlatformProxy } from "wrangler";
import type { D1 } from "@/lib/d1";

/**
 * Puts a local D1 (Miniflare's SQLite, the same engine `wrangler dev` uses)
 * where src/lib/d1.ts looks for it. Its own state directory, so a running
 * `wrangler dev` is not touched. Apply the schema first:
 *   npx wrangler d1 migrations apply booklet-spike --local --persist-to .wrangler/test-state
 */
export async function useLocalD1(): Promise<D1> {
  const g = globalThis as { __BOOKLET_D1__?: D1 };
  if (!g.__BOOKLET_D1__) {
    const proxy = await getPlatformProxy<{ DB: D1 }>({ persist: { path: ".wrangler/test-state/v3" } });
    g.__BOOKLET_D1__ = proxy.env.DB;
  }
  return g.__BOOKLET_D1__;
}
