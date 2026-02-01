"use client";

import { SelectButton } from "primereact/selectbutton";
import React, { useMemo, useState } from "react";

type MobilePane = "edit" | "preview";

export function AppShell({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  const [pane, setPane] = useState<MobilePane>("edit");

  const options = useMemo(
    () => [
      { label: "Edit", value: "edit" as const },
      { label: "Preview", value: "preview" as const },
    ],
    [],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Mobile toggle */}
      <div className="lg:hidden mb-3">
        <SelectButton
          value={pane}
          options={options}
          optionLabel="label"
          optionValue="value"
          allowEmpty={false}
          onChange={(e) => {
            const next = e.value as MobilePane | null | undefined;
            if (!next) return;
            setPane(next);
          }}
          className="w-full uppercase tracking-wide"
        />
      </div>

      <div
        className={
          "flex min-h-0 overflow-hidden w-full" +
          (pane === "edit" ? "" : " hidden lg:flex")
        }
      >
        {left}
      </div>

      <div
        className={
          "flex min-h-0 overflow-hidden w-full" +
          (pane === "preview" ? "" : " hidden lg:flex")
        }
      >
        {right}
      </div>
    </div>
  );
}
