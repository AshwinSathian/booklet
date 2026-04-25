"use client";

import React, { useState } from "react";

type MobilePane = "edit" | "preview";

export function AppShell({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  const [pane, setPane] = useState<MobilePane>("edit");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 grid grid-cols-1 lg:grid-cols-2 gap-0 h-full min-h-0 overflow-hidden">
      {/* Mobile pane toggle */}
      <div className="lg:hidden sticky top-2 z-10 col-span-1">
        <div className="flex items-center justify-center">
          <div className="flex rounded-pill border border-outline bg-bg-elevated p-0.5 shadow-card">
            {(["edit", "preview"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPane(p)}
                className={[
                  "rounded-pill px-5 py-1.5 text-xs font-semibold uppercase tracking-wider transition",
                  pane === p
                    ? "bg-accent text-white shadow-sm"
                    : "text-text-muted hover:text-text-primary",
                ].join(" ")}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={["flex min-h-0 overflow-hidden w-full", pane === "edit" ? "" : "hidden lg:flex"].join(" ")}>
        {left}
      </div>

      <div className={["flex min-h-0 overflow-hidden w-full", pane === "preview" ? "" : "hidden lg:flex"].join(" ")}>
        {right}
      </div>
    </div>
  );
}
