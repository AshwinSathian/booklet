"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type RequiredPlan = "pro" | "teams";

type UpgradeGateProps = {
  feature: string;
  requiredPlan?: RequiredPlan;
  children: ReactNode;
};

const PLAN_LABEL: Record<RequiredPlan, string> = {
  pro: "Readable Pro",
  teams: "Readable Teams",
};

// Renders children with a greyed-out overlay and a lock + upgrade prompt.
// Use this when the current user's plan does not have access to a feature.
export function UpgradeGate({ feature, requiredPlan = "pro", children }: UpgradeGateProps) {
  return (
    <div className="relative">
      {/* Greyed-out content */}
      <div className="pointer-events-none select-none opacity-40" aria-hidden>
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-start gap-2 px-1">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden className="text-text-muted shrink-0">
          <rect x="3" y="7" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="text-xs text-text-muted">{feature}</span>
        <Link
          href="/pricing"
          className="ml-1 rounded-pill border border-accent/40 bg-accent/10 px-2 py-0.5 text-2xs font-semibold text-accent transition hover:bg-accent/20"
        >
          {PLAN_LABEL[requiredPlan]}
        </Link>
      </div>
    </div>
  );
}
