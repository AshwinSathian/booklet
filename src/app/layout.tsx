import { Analytics } from "@/components/analytics/Analytics";
import { APP_NAME } from "@/lib/constants";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: `${APP_NAME} — Paste. Preview. Share.`,
  description:
    "Turn pasted text into clean, shareable pages for non-technical readers.",
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
