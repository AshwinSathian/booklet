import { AppClient } from "@/app/app/AppClient";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = buildMetadata({
  title: "App",
  description:
    "Paste Markdown on the left, preview a clean share page on the right, then publish a link.",
  pathname: "/app",
  noIndex: true, // product UI; keep marketing page indexed instead
});

export default function AppPage() {
  return <AppClient />;
}
