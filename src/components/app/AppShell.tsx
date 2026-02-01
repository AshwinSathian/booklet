"use client";

import React from "react";

export function AppShell({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="w-[90vw] mx-auto h-[80vh] max-h-[80vh] grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="flex h-full max-h-full min-h-0 overflow-hidden w-full">
        {left}
      </div>
      <div className="flex h-full max-h-full min-h-0 overflow-hidden w-full">
        {right}
      </div>
    </div>
  );
}
