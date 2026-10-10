import { resolveBearer, type Scope } from "@/lib/api-key-auth";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { problem, toErrorResponse } from "./errors";

/**
 * Wraps a /api/v1 handler with what every v1 route shares: bearer
 * authentication, the scope check for OAuth tokens, the per-user rate limit,
 * `RateLimit` headers on every response, and problem-details bodies for
 * anything the handler throws.
 *
 * `problem()` also carries an `error` member, which the web app's own session
 * routes need: the UI reads it. /api/v1 is RFC 9457 only, so it is dropped
 * on the way out (`rfc9457Only`).
 */
export function v1<C>(
  bucket: string,
  limitPerMin: number,
  scope: Scope,
  handler: (req: Request, userId: string, ctx: C) => Promise<Response>,
) {
  const run = async (req: Request, ctx?: C): Promise<Response> => {
    const auth = await resolveBearer(req);
    if (!auth) return problem(401, "Unauthorized", undefined, { "WWW-Authenticate": "Bearer" });
    if (auth.scopes && !auth.scopes.includes(scope)) {
      return problem(403, `This token does not have the ${scope} scope.`, undefined, {
        "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${scope}"`,
      });
    }

    const state = await consumeRateLimit(`v1__${bucket}__${auth.userId}`, limitPerMin);
    let res: Response;
    if (state.limited) {
      res = problem(429, "Too many requests. Please slow down and try again.");
    } else {
      try {
        res = await handler(req, auth.userId, ctx as C);
      } catch (e) {
        res = toErrorResponse(e);
      }
    }
    for (const [k, v] of Object.entries(rateLimitHeaders(state))) res.headers.set(k, v);
    return res;
  };

  // `ctx` is optional so routes without params can be called with one argument.
  return rfc9457Only(run) as (req: Request, ctx?: C) => Promise<Response>;
}

/**
 * Wraps a handler so a problem-details response leaves without the `error`
 * member. `v1()` applies it; the session-authenticated routes under
 * /api/v1 (API keys) use it directly.
 *
 * ponytail: re-serialises each error body. `problem()` is shared with the
 * session routes, `toErrorResponse` and `unverifiedResponse`, whose UI
 * callers read `error`; move those callers to `detail` and this goes away.
 */
export function rfc9457Only<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const res = await handler(...args);
    if (!res.headers.get("content-type")?.startsWith("application/problem+json")) return res;
    const { error: _error, ...body } = (await res.json()) as Record<string, unknown>;
    return Response.json(body, { status: res.status, headers: res.headers });
  };
}
