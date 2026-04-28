import { Analytics } from "@/components/analytics/Analytics";
import { APP_NAME } from "@/lib/constants";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://readable.ashwinsathian.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: `${APP_NAME} — Share Beautiful Markdown Pages Instantly`,

  description:
    "Convert any Markdown into a clean, beautifully formatted shareable page in seconds. Perfect for incident reports, ADRs, READMEs, and technical docs. Free, no account required.",

  applicationName: APP_NAME,

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
    "readable pages",
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
    title: `${APP_NAME} — Share Beautiful Markdown Pages Instantly`,
    description:
      "Convert any Markdown into a clean, beautifully formatted shareable page in seconds. Free, no account required.",
    url: SITE_URL,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Share Beautiful Markdown Pages`,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Share Beautiful Markdown Pages Instantly`,
    description:
      "Convert any Markdown into a clean, beautifully formatted shareable page in seconds. Free, no account required.",
    images: [
      {
        url: "/twitter-image",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Share Beautiful Markdown Pages`,
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
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
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en" suppressHydrationWarning className={inter.variable}>
        <body>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <Suspense fallback={null}>
              <Analytics />
            </Suspense>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
