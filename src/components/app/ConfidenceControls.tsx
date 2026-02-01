"use client";

import type { DocSettings } from "@/lib/blocks";
import { Dropdown } from "primereact/dropdown";

const SPACING = [
  { label: "Compact spacing", value: "compact" as const },
  { label: "Comfortable spacing", value: "comfortable" as const },
];

const WIDTH = [
  { label: "Normal width", value: "normal" as const },
  { label: "Wide width", value: "wide" as const },
];

const CODE = [
  { label: "Show code", value: "show" as const },
  { label: "Collapse long code", value: "collapse" as const },
];

export function ConfidenceControls({
  value,
  onChange,
}: {
  value: DocSettings;
  onChange: (next: DocSettings) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Dropdown
        value={value.spacing}
        options={SPACING}
        onChange={(e) => onChange({ ...value, spacing: e.value })}
        className="ltmd:w-full min-w-fit"
        checkmark={true}
        highlightOnSelect={true}
      />
      <Dropdown
        value={value.width}
        options={WIDTH}
        onChange={(e) => onChange({ ...value, width: e.value })}
        className="ltmd:w-full min-w-fit"
        checkmark={true}
        highlightOnSelect={true}
      />
      <Dropdown
        value={value.code}
        options={CODE}
        onChange={(e) => onChange({ ...value, code: e.value })}
        className="ltmd:w-full min-w-fit"
        checkmark={true}
        highlightOnSelect={true}
      />
    </div>
  );
}
