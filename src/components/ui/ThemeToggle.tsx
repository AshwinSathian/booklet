"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return <div className="h-8 w-8 shrink-0" aria-hidden />;

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-outline/40 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
      <Icon name={isDark ? "sun" : "moon"} size={15} />
    </button>
  );
}
