"use client";

import { LEGACY_HASHES } from "@/lib/docs-nav";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * /api-docs, /integrations and /mcp-setup redirect here, and the browser
 * carries the old fragment along. This sends a fragment that named a
 * section of one of those pages to where that section lives now.
 */
export function LegacyHashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const target = LEGACY_HASHES[window.location.hash.slice(1)];
    if (target && target !== window.location.pathname + window.location.hash) router.replace(target);
  }, [router]);
  return null;
}
