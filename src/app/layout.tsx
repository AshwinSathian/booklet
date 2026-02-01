import PrimeStyles from "@/components/ui/PrimeStyles";
import { APP_NAME } from "@/lib/constants";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} — Paste. Preview. Share.`,
  description:
    "Turn pasted tech-heavy text into clean, confidently shareable pages for non-technical readers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <PrimeStyles />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
