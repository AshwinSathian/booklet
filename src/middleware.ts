import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

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
  // Admin route: IP-allowlist only — never reaches Clerk auth
  if (req.nextUrl.pathname.startsWith("/admin")) {
    const ip =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const allowed = (process.env.ADMIN_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    // In development always allow loopback
    if (process.env.NODE_ENV !== "development" && !allowed.includes(ip)) {
      return new Response("Forbidden", { status: 403 });
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
