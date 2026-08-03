"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const SCROLL_THRESHOLD = 0.6; // show after 60% of page height scrolled
const DISMISS_KEY = "booklet_scroll_cta_dismissed";

export function ScrollCta({ href }: { href: string }) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    // Don't show if user dismissed it in this session
    if (sessionStorage.getItem(DISMISS_KEY)) {
      setDismissed(true);
      return;
    }

    const check = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (!shownRef.current && scrolled / total >= SCROLL_THRESHOLD) {
        shownRef.current = true;
        setVisible(true);
      }
    };

    window.addEventListener("scroll", check, { passive: true });
    check();
    return () => window.removeEventListener("scroll", check);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  if (dismissed || !visible) return null;

  return (
    <div
      className={[
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-40 print:hidden",
        "transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      ].join(" ")}
    >
      <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg shadow-lg px-4 py-3">
        <div className="flex flex-col leading-snug">
          <span className="text-xs font-semibold text-text-primary">Like what you read?</span>
          <span className="text-2xs text-text-muted">Create your own page — free, no account needed.</span>
        </div>
        <Link
          href={href}
          onClick={handleDismiss}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-pill bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-contrast transition hover:bg-accent-hover active:scale-[0.97]"
        >
          Write
          <svg width="9" height="9" fill="none" viewBox="0 0 11 11" aria-hidden>
            <path d="M2 9 9 2M9 2H4.5M9 2v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 h-5 w-5 flex items-center justify-center rounded text-text-muted/50 transition hover:text-text-muted hover:bg-fill-2"
        >
          <svg width="9" height="9" fill="none" viewBox="0 0 10 10" aria-hidden>
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
