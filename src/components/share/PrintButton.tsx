"use client";

import { Icon } from "@/components/ui/Icon";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      title="Print / Save as PDF"
      className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-muted transition hover:border-border-strong hover:text-text-primary"
    >
      <Icon name="print" size={13} />
      Print
    </button>
  );
}
