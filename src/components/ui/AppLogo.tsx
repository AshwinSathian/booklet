"use client";

import { APP_NAME, ROUTES } from "@/lib/constants";
import Link from "next/link";

function ReadableMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect width="24" height="24" rx="5.5" fill="var(--color-accent)" />
      <rect x="8.85" y="6.35" width="1.9" height="11.3" rx="0.95" fill="white" />
      <rect x="13.25" y="6.35" width="1.9" height="11.3" rx="0.95" fill="white" />
      <rect x="6.35" y="8.85" width="11.3" height="1.9" rx="0.95" fill="white" />
      <rect x="6.35" y="13.25" width="11.3" height="1.9" rx="0.95" fill="white" />
      <rect x="15.55" y="6.7" width="1.75" height="1.7" rx="0.5" fill="white" fillOpacity="0.55" />
    </svg>
  );
}

export function AppLogo({ onlyIcon = false }: { onlyIcon?: boolean }) {
  return (
    <Link
      href={ROUTES.home}
      aria-label={`${APP_NAME} — go to homepage`}
      className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
    >
      <ReadableMark size={28} />
      {!onlyIcon ? (
        <span className="text-sm font-light tracking-[-0.01em] text-text-primary">
          {APP_NAME}
        </span>
      ) : null}
    </Link>
  );
}
