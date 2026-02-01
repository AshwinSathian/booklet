import PrimeStyles from "@/components/ui/PrimeStyles";
import { APP_NAME } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  ...buildMetadata({
    title: APP_NAME,
    description:
      "Turn any Markdown into clean, confidently shareable pages for non-technical readers.",
    pathname: "/",
  }),
  icons: {
    icon: [{ url: "/favicon.ico" }],
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
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
