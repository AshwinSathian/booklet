import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/request-ip";

const isProtected = createRouteMatcher(["/my-pages(.*)"]);

// Clerk FAPI host — derived from the publishable key (pk_live_Y2xlcmsuYXNod2luc2F0aGlhbi5jb20k → clerk.ashwinsathian.com)
const CLERK_HOST = "https://clerk.ashwinsathian.com";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    // Clerk's FAPI serves its own JS bundle; also need Google Tag Manager.
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${CLERK_HOST} https://challenges.cloudflare.com https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline'",
    // Allow profile avatars from Clerk's image CDN and any HTTPS source.
    "img-src 'self' data: blob: https: https://img.clerk.com",
    "font-src 'self' data:",
    // connect-src: Clerk FAPI + Google OAuth token endpoints + Analytics.
    // accounts.google.com needed when Clerk's SDK verifies Google ID tokens client-side.
    // appleid.apple.com needed for Apple Sign In token verification.
    `connect-src 'self' ${CLERK_HOST} https://accounts.google.com https://oauth2.googleapis.com https://appleid.apple.com https://www.google-analytics.com https://region1.google-analytics.com`,
    // frame-src: Clerk FAPI (account iframes/modals), Cloudflare Turnstile, Google OAuth popup.
    `frame-src ${CLERK_HOST} https://challenges.cloudflare.com https://accounts.google.com https://appleid.apple.com`,
    "worker-src blob:",
    "object-src 'none'",
    "base-uri 'self'",
    // form-action: Clerk's <SignIn>/<SignUp> components render <form> elements that
    // POST to the Clerk FAPI.  'self' alone blocks those submissions.
    `form-action 'self' ${CLERK_HOST}`,
  ].join("; "),
};

export default clerkMiddleware(async (auth, req) => {
  // Admin route: two independent checks must BOTH pass — an IP allowlist
  // AND a signed-in, allowlisted admin user. Neither check alone is
  // sufficient (see P0-9 / P1-5 in the security audit): the IP check can
  // only ever be as trustworthy as `cf-connecting-ip` (see getClientIp),
  // and a leaked/allowlisted IP must not be enough on its own to reach an
  // internal dashboard.
  if (req.nextUrl.pathname.startsWith("/admin")) {
    const isDev = process.env.NODE_ENV === "development";

    // Layer 1: IP allowlist. Fails closed — an empty/unset ADMIN_IPS means
    // nobody passes, not "no restriction configured".
    const ip = getClientIp(req);
    const allowedIps = (process.env.ADMIN_IPS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // In development always allow loopback — there's no Cloudflare/real IP
    // to check locally.
    if (!isDev && !allowedIps.includes(ip)) {
      return new Response("Forbidden", { status: 403 });
    }

    // Layer 2: authenticated + allowlisted admin user. Checked explicitly
    // (rather than via auth.protect()'s sign-in redirect) so an
    // unauthenticated visitor is rejected outright with 403 instead of
    // being parked on a sign-in page that later succeeds without this
    // check being re-evaluated. Fails closed — an empty/unset
    // ADMIN_USER_IDS means the route is inaccessible to everyone.
    if (!isDev) {
      const { userId } = await auth();
      const allowedUserIds = (process.env.ADMIN_USER_IDS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!userId || allowedUserIds.length === 0 || !allowedUserIds.includes(userId)) {
        return new Response("Forbidden", { status: 403 });
      }
    }
  }

  if (isProtected(req)) {
    await auth.protect();
  }

  const res = NextResponse.next();

  // Embed pages must be iframe-able from any origin.
  const isEmbedRoute = /^\/p\/[^/]+\/embed(\/|$)/.test(req.nextUrl.pathname);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (isEmbedRoute && key === "X-Frame-Options") continue;
    if (isEmbedRoute && key === "Content-Security-Policy") {
      res.headers.set(key, value.replace(/frame-ancestors[^;]*(;|$)/, "frame-ancestors *$1"));
      continue;
    }
    res.headers.set(key, value);
  }
  return res;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
