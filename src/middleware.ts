import { NextResponse, type NextRequest } from "next/server";
import { getClientIp } from "@/lib/request-ip";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { claimCookieName } from "@/lib/claim-cookie";
import { goneNoticeHtml, isGoneReason, type GoneReason } from "@/lib/gone-notice";

// 'unsafe-eval' is dropped in production: nothing in this codebase calls
// eval()/new Function() (verified — grepped clean), and Next's dev server
// needs it only for Fast Refresh. The diagram renderer (@viz-js/viz) is
// WASM-based, which needs the separate, narrower 'wasm-unsafe-eval' keyword
// instead — that one stays in every environment.
//
// 'unsafe-inline' on script-src remains for now: removing it requires a
// per-request nonce plumbed through the root layout, which per Next.js's
// own CSP guide requires forcing dynamic rendering on every page (nonces
// change per request, so pages that read one can't be statically
// generated/ISR'd) — a real perf/caching trade-off for the public share
// pages this app's value prop depends on, not a drop-in hardening change.
// Flagged as a follow-up decision rather than made unilaterally here.
const SCRIPT_SRC =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
    : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // TLS is terminated in front of this app (Cloudflare Tunnel) — HSTS is
  // still correct to set here since it's a response header the browser
  // reads regardless of where TLS ends, and this app has no non-TLS
  // production hostname for it to break.
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": [
    "default-src 'self'",
    SCRIPT_SRC,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'none'",
    // Modern replacement for X-Frame-Options; overridden to '*' for /p/[id]/embed
    // below. X-Frame-Options is also still set for older-browser defense in depth.
    "frame-ancestors 'none'",
    "worker-src blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

// booklet-api.ashwinsathian.com is the same Next.js process as
// booklet.ashwinsathian.com (see ecosystem.config.js — one PM2 app, one
// port), routed under its own hostname purely so external API consumers
// (CLI, GitHub Action, MCP server) have a stable,
// clearly-scoped entry point distinct from the marketing/editor UI. This is
// enforced here, not just a DNS-level convention: that hostname serves
// /api/* only, everything else 404s. The main hostname keeps serving both
// the UI and /api/* as before (the web app's own client-side code calls
// same-origin /api/* routes — those must keep working there too).
//
// The old readable-api.ashwinsathian.com hostname (pre-rename) was
// decommissioned at the Cloudflare Tunnel level 2026-07-23 — it 404s before
// ever reaching this app now, so it's intentionally not listed here.
const API_HOSTNAME = "booklet-api.ashwinsathian.com";

const SHARE_PATH = /^\/p\/([^/]+)(\/embed)?\/?$/;

/**
 * Asks the app's own Node runtime whether a share page is gone (taken down,
 * or an expired anonymous page). This middleware runs on the Edge runtime,
 * which has no MongoDB driver, and a Server Component cannot return 410 —
 * so the status has to be decided here, with the lookup done by
 * /api/pages/:id/gone over loopback.
 *
 * Fails open: if the check errors or times out the request continues, and
 * the page's own render guard still refuses to show the content (with a
 * 200 instead of a 410). Availability of every share page must not hinge
 * on this hop.
 */
async function fetchGoneReason(id: string): Promise<GoneReason | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/pages/${encodeURIComponent(id)}/gone`, {
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { gone?: unknown };
    return isGoneReason(body.gone) ? body.gone : null;
  } catch {
    return null;
  }
}

function withSecurityHeaders(res: Response, isEmbedRoute: boolean): Response {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (isEmbedRoute && key === "X-Frame-Options") continue;
    if (isEmbedRoute && key === "Content-Security-Policy") {
      res.headers.set(key, value.replace(/frame-ancestors[^;]*(;|$)/, "frame-ancestors *$1"));
      continue;
    }
    res.headers.set(key, value);
  }
  return res;
}

export default async function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (host === API_HOSTNAME || host.startsWith(`${API_HOSTNAME}:`)) {
    if (!req.nextUrl.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }
  }

  // Admin route: IP allowlist. Fails closed — an empty/unset ADMIN_IPS means
  // nobody passes, not "no restriction configured". The authoritative
  // session + ADMIN_USER_IDS check lives in src/app/admin/layout.tsx (a
  // real Mongo-backed session lookup belongs in a Node.js-runtime Route
  // Handler/Server Component, not in Edge middleware).
  if (req.nextUrl.pathname.startsWith("/admin")) {
    const isDev = process.env.NODE_ENV === "development";
    const ip = getClientIp(req.headers);
    const allowedIps = (process.env.ADMIN_IPS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!isDev && !allowedIps.includes(ip)) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // /my-pages: cheap, non-authoritative UX redirect for the common case of
  // no session cookie at all — avoids rendering a server component that
  // would just redirect anyway. This is NOT the security boundary; every
  // /my-pages page performs its own authoritative getSession() check.
  if (req.nextUrl.pathname.startsWith("/my-pages") && !req.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Embed pages must be iframe-able from any origin.
  const isEmbedRoute = /^\/p\/[^/]+\/embed(\/|$)/.test(req.nextUrl.pathname);

  const share = SHARE_PATH.exec(req.nextUrl.pathname);
  if (share && (req.method === "GET" || req.method === "HEAD")) {
    let id = share[1];
    try {
      id = decodeURIComponent(id);
    } catch {
      /* malformed escape: look it up as-is, it will not match anything */
    }
    // Markdown for agents: `/p/:id.md`, or `/p/:id` asked for as
    // text/markdown and not as HTML. IDs and slugs never contain a dot, so
    // the suffix is unambiguous. The route decides what may be served.
    const accept = req.headers.get("accept") ?? "";
    const wantsMarkdown = id.endsWith(".md") || (/text\/markdown/i.test(accept) && !/text\/html/i.test(accept));
    if (wantsMarkdown && !share[2]) {
      const pageId = id.replace(/\.md$/, "");
      return withSecurityHeaders(
        NextResponse.rewrite(new URL(`/api/pages/${encodeURIComponent(pageId)}/markdown`, req.url)),
        false,
      );
    }

    const reason = await fetchGoneReason(id);
    // An expired page stays reachable from the browser that published it
    // until the purge deletes it, so its author can still claim it. Only
    // the cookie's presence is checked here; the page verifies the token
    // and shows everyone else the same notice (see expiryForAuthor there).
    const mayBeAuthor = reason === "expired" && req.cookies.has(claimCookieName(id));
    if (reason && !mayBeAuthor) {
      return withSecurityHeaders(
        new Response(req.method === "HEAD" ? null : goneNoticeHtml(reason), {
          status: 410,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-robots-tag": "noindex",
          },
        }),
        isEmbedRoute,
      );
    }
  }

  const res = NextResponse.next();
  if (share && !share[2]) {
    res.headers.set("Link", `</p/${share[1]}.md>; rel="alternate"; type="text/markdown"`);
    res.headers.set("Vary", "Accept");
  }
  return withSecurityHeaders(res, isEmbedRoute);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
