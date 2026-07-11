"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { useSession } from "./SessionProvider";

// Deterministic hue from the user id — same scheme as src/app/u/[id]/page.tsx's
// public-profile avatar, so an account's own menu avatar and its public
// author-page avatar always match.
function avatarHue(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

// Replaces Clerk's <UserButton /> — a minimal avatar-triggered dropdown with
// the account's email, a link to My Pages, and sign out.
export function AccountMenu() {
  const { userId, email } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  if (!userId) return null;

  const initials = (email?.trim()[0] ?? "?").toUpperCase();
  const hue = avatarHue(userId);

  async function handleSignOut() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold transition"
        style={{
          backgroundColor: `hsl(${hue} 70% 92%)`,
          borderColor: `hsl(${hue} 70% 80%)`,
          color: `hsl(${hue} 60% 40%)`,
        }}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-lg border border-outline bg-bg-elevated py-1 shadow-lg">
          {email && (
            <div className="mb-1 truncate border-b border-border-subtle px-3 py-1.5 text-xs text-text-muted">
              {email}
            </div>
          )}
          <Link
            href={ROUTES.myPages}
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 text-sm text-text-secondary transition hover:bg-fill-1 hover:text-text-primary"
          >
            My pages
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="block w-full px-3 py-1.5 text-left text-sm text-text-secondary transition hover:bg-fill-1 hover:text-text-primary"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
