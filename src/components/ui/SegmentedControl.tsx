"use client";

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-outline bg-bg-soft p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition",
            value === opt.value
              ? "bg-accent text-white shadow-sm"
              : "text-text-muted hover:bg-fill-2 hover:text-text-primary",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
