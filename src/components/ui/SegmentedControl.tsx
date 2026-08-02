"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  const selectedIndex = options.findIndex((o) => o.value === value);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const buttons = container.querySelectorAll<HTMLButtonElement>("button");
    const btn = buttons[selectedIndex];
    if (!btn) return;
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [selectedIndex, options.length]);

  return (
    <div ref={containerRef} className="relative flex rounded-lg border border-border-default bg-bg-soft p-0.5 gap-0.5">
      {/* Sliding background pill */}
      {indicator ? (
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-md bg-accent shadow-soft pointer-events-none transition-all duration-normal ease-spring"
          style={{ left: indicator.left, width: indicator.width }}
        />
      ) : null}

      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            "relative z-10 flex-1 rounded-md px-3 py-1.5 text-xs font-semibold",
            "transition-colors duration-fast",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
            value === opt.value
              ? "text-white"
              : "text-text-muted hover:text-text-primary",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
