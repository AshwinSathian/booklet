"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { useSession } from "./SessionProvider";

const LINKS = [
  { href: ROUTES.myPages, label: "My pages" },
  { href: ROUTES.spaces, label: "Spaces" },
  { href: ROUTES.account, label: "Account" },
  { href: ROUTES.apiKeys, label: "API keys" },
  { href: ROUTES.webhooks, label: "Webhooks" },
] as const;

const ITEM = "block w-full px-3 py-2 text-left text-sm text-text-secondary transition hover:bg-fill-2 hover:text-text-primary";

/** An account's initial: ink on a soft tile. Shared with the public author page. */
export function Avatar({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-soft font-semibold text-text-primary ${className}`}
    >
      {initials}
    </span>
  );
}

// An avatar-triggered dropdown with the account's email, links to My pages,
// Spaces, Account, API keys and Webhooks, and sign out.
export function AccountMenu() {
  const { userId, email, refetch } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  if (!userId) return null;

  async function handleSignOut() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    await refetch();
    router.push("/");
    router.refresh();
  }

  return (
    // Below sm the menu hangs from the header, not the avatar: the avatar can
    // sit mid-bar, where a menu anchored to it runs off the screen.
    <div ref={rootRef} className="sm:relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex rounded-full transition hover:opacity-80"
      >
        <Avatar initials={(email?.trim()[0] ?? "?").toUpperCase()} className="h-8 w-8 text-xs" />
      </button>

      {open && (
        <div
          data-account-menu
          className="absolute right-3 top-full z-30 mt-2 w-52 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border-default bg-bg-elevated py-1 shadow-glass sm:right-0"
        >
          {email && <div className="mb-1 truncate border-b border-border-subtle px-3 py-2 text-xs text-text-muted">{email}</div>}
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className={ITEM}>
              {link.label}
            </Link>
          ))}
          <button type="button" onClick={() => void handleSignOut()} className={`${ITEM} mt-1 border-t border-border-subtle`}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
