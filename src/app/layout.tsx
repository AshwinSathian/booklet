import { SessionProvider } from "@/components/auth/SessionProvider";
import { buildMetadata } from "@/lib/seo";
import type { Metadata, Viewport } from "next";
import { Source_Serif_4 } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "next-themes";
import { headers } from "next/headers";
import "./globals.css";

// Distinct reading typeface for published-page body content — see
// --font-reading in globals.css and DocSettings.typeface in src/lib/blocks.ts.
// Deliberately separate from Geist Sans (the UI/chrome font): "type is the
// product" means the thing people screenshot and share should read as a
// considered editorial artifact, not generic app chrome.
const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  // Variable weight, with the optical-size axis: the display cut at
  // headline sizes, the text cut at reading sizes.
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-source-serif-4",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://booklet.ashwinsathian.com";

// The site's own title, description, canonical and link preview, which a
// page replaces through buildMetadata(). No author or keywords here: they
// would be inherited by every page, and a page someone published is theirs.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...buildMetadata({
    description:
      "Publish Markdown incident reports, ADRs, RFCs and runbooks as web pages, with team spaces. Free, and you can try it without an account.",
  }),
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The request's script nonce (src/middleware.ts). Reading it is also what
  // makes every page render per request, which a nonce requires.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <SessionProvider>
      <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${sourceSerif4.variable}`}>
        <body>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem nonce={nonce}>
            {children}
          </ThemeProvider>
        </body>
      </html>
    </SessionProvider>
  );
}
