"use client";

import { useTheme } from "next-themes";
import { Button } from "primereact/button";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resolvedTheme = theme === "dark" ? "dark" : "light";
  const icon = resolvedTheme === "dark" ? "pi pi-sun" : "pi pi-moon";

  return (
    <>
      {mounted && (
        <Button
          icon={icon}
          className="readable-theme-toggle"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          text
          raised
          severity="secondary"
        />
      )}
    </>
  );
}
