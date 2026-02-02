"use client";

import { APP_NAME, ROUTES } from "@/lib/constants";
import Link from "next/link";

export function AppLogo() {
  return (
    <Link href={ROUTES.home}>
      <div className="flex items-center gap-1 m-0 p-0">
        <img
          src="/favicon.png"
          alt={APP_NAME}
          className="h-15 w-15"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-0">
          <div className="font-semibold tracking-wide uppercase">
            {APP_NAME}
          </div>
          <div className="hidden sm:inline text-xs text-text-muted tracking-widest uppercase">
            Paste. Preview. Share.
          </div>
        </div>
      </div>
    </Link>
  );
}
