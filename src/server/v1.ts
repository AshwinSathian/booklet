import { resolveBearer, type Scope } from "@/lib/api-key-auth";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { problem, toErrorResponse } from "./errors";

/**
 * Wraps a /api/v1 handler with what every v1 route shares: bearer
 * authentication, the scope check for OAuth tokens, the per-user rate limit,
 * `RateLimit` headers on every response, and problem-details bodies for
 * anything the handler throws.
 */
export function v1<C>(
  bucket: string,
  limitPerMin: number,
  scope: Scope,
  handler: (req: Request, userId: string, ctx: C) => Promise<Response>,
) {
  // `ctx` is optional so routes without params can be called with one argument.
  return async (req: Request, ctx?: C): Promise<Response> => {
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
      res = problem(429, "Too many requests. Wait for the time in Retry-After, then try again.");
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
}
