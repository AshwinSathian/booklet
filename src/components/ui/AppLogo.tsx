"use client";

import { APP_NAME, ROUTES } from "@/lib/constants";
import Link from "next/link";

/** The mark: an ink tile, a paper page with a folded corner, one highlighted line. */
export function BookletMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect width="24" height="24" rx="5.5" fill="var(--color-accent)" />
      <path
        d="M6.5 6.5C6.5 5.67157 7.17157 5 8 5H15.2L17.5 7.3V17.5C17.5 18.3284 16.8284 19 16 19H8C7.17157 19 6.5 18.3284 6.5 17.5V6.5Z"
        fill="var(--color-accent-contrast)"
      />
      <path d="M15.2 5L17.5 7.3H16C15.5582 7.3 15.2 6.94183 15.2 6.5V5Z" fill="var(--color-accent)" fillOpacity="0.25" />
      <rect x="8.7" y="9.2" width="6.9" height="2.3" rx="0.4" fill="var(--color-highlight)" />
      <rect x="8.7" y="13" width="4.6" height="1.2" rx="0.6" fill="var(--color-accent)" fillOpacity="0.35" />
    </svg>
  );
}

export function AppLogo({ onlyIcon = false, href = ROUTES.home }: { onlyIcon?: boolean; href?: string }) {
  return (
    <Link
      href={href}
      aria-label={href === ROUTES.home ? `${APP_NAME} — go to homepage` : `${APP_NAME} — go to the editor`}
      className="flex items-center gap-2 rounded-sm"
    >
      <BookletMark size={28} />
      {!onlyIcon ? (
        <span className="font-display text-[1.0625rem] font-semibold tracking-[-0.01em] text-text-primary">{APP_NAME}</span>
      ) : null}
    </Link>
  );
}
