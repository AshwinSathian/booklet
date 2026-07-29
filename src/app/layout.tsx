import { Analytics } from "@/components/analytics/Analytics";
import { APP_NAME } from "@/lib/constants";
import { SessionProvider } from "@/components/auth/SessionProvider";
import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Distinct reading typeface for published-page body content — see
// --font-reading in globals.css and DocSettings.typeface in src/lib/blocks.ts.
// Deliberately separate from Inter (the UI/chrome font): "type is the
// product" means the thing people screenshot and share should read as a
// considered editorial artifact, not generic app chrome.
const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-source-serif-4",
  display: "swap",
});

// Editorial display typeface — hero/section headlines and (via a lower
// optical-size setting) published-page body copy, see --font-display in
// globals.css and "The Reveal" in
// docs/superpowers/specs/2026-07-28-visual-elevation-design.md. Fraunces'
// opsz variable axis is exposed via next/font's `axes` option — it's the
// only axis actually used (see .font-display-hero/.font-display-body in
// globals.css); italic style and the SOFT/WONK axes were trimmed since
// nothing in the app renders italic Fraunces or touches those axes, and
// including them only grows the self-hosted font payload for no visual
// benefit.
// NOTE: `weight` must be "variable" (not a static array) when `axes` is set —
// next/font only exposes variable-font axes on the variable-weight build; a
// static weight array + axes throws "Axes can only be defined for variable
// fonts when the weight property is nonexistent or set to `variable`" at
// build/dev time.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://booklet.ashwinsathian.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: `${APP_NAME} — Written in Markdown, Read by Everyone Else`,

  description:
    "Turn incident reports, ADRs, and runbooks into a clean page anyone can open and read — no account, no formatting step. Free, in seconds.",

  applicationName: APP_NAME,

  manifest: "/manifest.json",

  keywords: [
    "markdown viewer",
    "share markdown online",
    "markdown to html",
    "markdown preview",
    "markdown page publisher",
    "technical writing tool",
    "shareable markdown link",
    "incident report template",
    "ADR template",
    "README viewer",
    "markdown formatter",
    "postmortem template",
    "runbook template",
  ],

  authors: [{ name: "Ashwin Sathian" }],
  creator: "Ashwin Sathian",

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — Written in Markdown, Read by Everyone Else`,
    description:
      "Turn incident reports, ADRs, and runbooks into a clean page anyone can open and read — no account, no formatting step.",
    url: SITE_URL,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Written in Markdown. Read by everyone else.`,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Written in Markdown, Read by Everyone Else`,
    description:
      "Turn incident reports, ADRs, and runbooks into a clean page anyone can open and read — no account, no formatting step.",
    images: [
      {
        url: "/twitter-image",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Written in Markdown. Read by everyone else.`,
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <html lang="en" suppressHydrationWarning className={`${inter.variable} ${sourceSerif4.variable} ${fraunces.variable}`}>
        <body>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <Suspense fallback={null}>
              <Analytics />
            </Suspense>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </SessionProvider>
  );
}
