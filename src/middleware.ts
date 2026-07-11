import { NextResponse, type NextRequest } from "next/server";
import { getClientIp } from "@/lib/request-ip";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
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

export default function middleware(req: NextRequest) {
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
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
