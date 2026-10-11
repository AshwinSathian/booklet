import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession, getSession } from "@/lib/auth/session";
import { getSsoProvider, ssoExchange } from "@/lib/auth/sso";
import { ROUTES } from "@/lib/constants";
import { logError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { isSafeRedirect } from "@/lib/safe-redirect";
import { getSiteOrigin } from "@/lib/site-url";
import { linkIdentity, resolveSsoUser, SsoLinkError } from "@/server/sso";
import { SSO_COOKIE } from "../route";

export const runtime = "nodejs";

type Flow = { provider: string; state: string; verifier: string; redirect: string | null; connect: string | null };

function readFlow(raw: string | undefined): Flow | null {
  try {
    const v = JSON.parse(raw ?? "") as Partial<Flow>;
    if (typeof v.provider !== "string" || typeof v.state !== "string" || typeof v.verifier !== "string") return null;
    return {
      provider: v.provider,
      state: v.state,
      verifier: v.verifier,
      redirect: isSafeRedirect(v.redirect) ? v.redirect : null,
      connect: typeof v.connect === "string" ? v.connect : null,
    };
  } catch {
    return null;
  }
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * The provider sends the browser back here. Every failure lands on a
 * Booklet page with a short code in `?error=`; nothing from the provider's
 * query string is echoed.
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const origin = getSiteOrigin(req);
  const store = await cookies();
  const flow = readFlow(store.get(SSO_COOKIE)?.value);
  store.delete({ name: SSO_COOKIE, path: "/api/auth/sso" });

  const back = (path: string, error?: string) =>
    NextResponse.redirect(`${origin}${path}${error ? `${path.includes("?") ? "&" : "?"}error=${error}` : ""}`);
  const failPath = flow?.connect ? ROUTES.security : ROUTES.signIn;

  const provider = getSsoProvider((await params).provider);
  if (!provider) return new Response("Not found", { status: 404 });

  const limited = await checkRateLimit(`sso_callback__ip__${getClientIp(req.headers)}`, 20);
  if (limited) return limited;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // The state in the cookie is what ties this response to a sign-in this
  // browser started. Without it an attacker could finish their own sign-in
  // in a victim's browser.
  if (!flow || flow.provider !== provider.id || !state || !sameString(state, flow.state)) return back(failPath, "sso_state");
  if (!code) return back(failPath, "sso_cancelled");

  try {
    const profile = await ssoExchange(provider, code, `${origin}/api/auth/sso/${provider.id}/callback`, flow.verifier);
    if (!profile) return back(failPath, "sso_no_email");

    if (flow.connect) {
      // The account that asked to connect must still be the one signed in.
      const session = await getSession();
      if (session?.userId !== flow.connect) return back(ROUTES.signIn, "sso_state");
      await linkIdentity(session.userId, provider.id, profile);
      return back(ROUTES.security);
    }

    await createSession(await resolveSsoUser(provider.id, profile));
    return back(flow.redirect ?? ROUTES.app);
  } catch (err) {
    if (err instanceof SsoLinkError) return back(failPath, `sso_${err.message}`);
    logError("sso", `${provider.id} sign-in failed`, err);
    return back(failPath, "sso_failed");
  }
}
