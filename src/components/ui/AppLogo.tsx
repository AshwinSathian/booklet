"use client";

import { APP_NAME, ROUTES } from "@/lib/constants";
import Link from "next/link";

function ReadableMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect width="24" height="24" rx="5.5" fill="var(--color-accent)" />
      <path
        d="M 6.5 5 L 6.5 19 M 6.5 5 L 13 5 Q 17 5 17 9 Q 17 13 13 13 L 6.5 13 M 11.5 13 L 17 19"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
