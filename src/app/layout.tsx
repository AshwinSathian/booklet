import { Analytics } from "@/components/analytics/Analytics";
import { APP_NAME } from "@/lib/constants";
import { SessionProvider } from "@/components/auth/SessionProvider";
import type { Metadata, Viewport } from "next";
import { Source_Serif_4 } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import "./globals.css";

// Distinct reading typeface for published-page body content — see
// --font-reading in globals.css and DocSettings.typeface in src/lib/blocks.ts.
// Deliberately separate from Geist Sans (the UI/chrome font): "type is the
// product" means the thing people screenshot and share should read as a
// considered editorial artifact, not generic app chrome.
const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-source-serif-4",
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
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
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
      <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${sourceSerif4.variable}`}>
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
