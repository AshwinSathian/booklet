import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { HeadersAdapter } from "next/dist/server/web/spec-extension/adapters/headers";
import { createSessionRecord } from "@/lib/db/auth";
import { hashSessionToken } from "@/lib/auth/session-token";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

/**
 * Runs `fn` inside the two AsyncLocalStorage stores Next.js sets up around a
 * real request, so `cookies()`/`headers()` from "next/headers" resolve
 * against `req` instead of throwing "called outside a request scope". This is
 * what lets a unit spec call a session-authenticated Route Handler directly
 * (the API-key routes never needed it — they read `req.headers` themselves).
 *
 * Depends on the AsyncLocalStorage shim in playwright.unit.config.ts.
 * Reaches into next/dist internals, so a Next upgrade can break it; the
 * failure mode is loud (every spec using it throws), not a silent pass.
 */
export function withRequestScope<T>(req: Request, fn: () => Promise<T>): Promise<T> {
  const cookies = RequestCookiesAdapter.seal(new RequestCookies(req.headers));
  const store = {
    type: "request",
    phase: "render",
    cookies,
    headers: HeadersAdapter.seal(req.headers),
    usedDynamic: false,
  };
  return workAsyncStorage.run({ route: "/unit-test" } as never, () =>
    workUnitAsyncStorage.run(store as never, fn),
  );
}

/** Creates a real session row and returns the Cookie header value for it. */
export async function sessionCookieFor(userId: string): Promise<string> {
  process.env.SESSION_TOKEN_PEPPER ??= "test-only-pepper-do-not-use-in-prod";
  const raw = `test-session-${crypto.randomUUID()}`;
  await createSessionRecord(userId, await hashSessionToken(raw), new Date(Date.now() + 3_600_000));
  return `${SESSION_COOKIE_NAME}=${raw}`;
}
