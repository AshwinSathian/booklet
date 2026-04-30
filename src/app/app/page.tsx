import { AppClient } from "@/app/app/AppClient";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "Editor",
  description:
    "Write Markdown, preview a clean formatted page, and publish a shareable link — in seconds.",
  pathname: "/app",
  noIndex: true, // product UI; keep marketing page indexed instead
});

export default function AppPage() {
  return <AppClient />;
}
