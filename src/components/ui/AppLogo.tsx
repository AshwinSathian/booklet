"use client";

import { APP_NAME, ROUTES } from "@/lib/constants";
import Link from "next/link";

export function BookletMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect width="24" height="24" rx="5.5" fill="var(--color-accent)" />
      {/* The page — a rounded rect with its top-right corner folded down: a page
          worth flagging. The fold's shadow is a plain black tint now, not the
          retired paper-cream fill. */}
      <path
        d="M6.5 6.5C6.5 5.67157 7.17157 5 8 5H15.2L17.5 7.3V17.5C17.5 18.3284 16.8284 19 16 19H8C7.17157 19 6.5 18.3284 6.5 17.5V6.5Z"
        fill="white"
      />
      <path d="M15.2 5L17.5 7.3H16C15.5582 7.3 15.2 6.94183 15.2 6.5V5Z" fill="rgba(0, 0, 0, 0.18)" />
      <rect x="8.7" y="9.6" width="6.9" height="1.5" rx="0.75" fill="var(--color-accent)" fillOpacity="0.85" />
      <rect x="8.7" y="12.6" width="4.6" height="1.5" rx="0.75" fill="var(--color-accent)" fillOpacity="0.55" />
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
      <BookletMark size={28} />
      {!onlyIcon ? (
        <span className="text-sm font-light tracking-[-0.01em] text-text-primary">
          {APP_NAME}
        </span>
      ) : null}
    </Link>
  );
}
