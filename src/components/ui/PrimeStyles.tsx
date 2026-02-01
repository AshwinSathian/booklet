"use client";

import {
  PRIME_CORE_CSS_HREF,
  PRIME_ICONS_CSS_HREF,
  PRIME_THEME_DARK_HREF,
  PRIME_THEME_LIGHT_HREF,
  PRIME_THEME_LINK_ID,
} from "@/app/styles/primereact-theme";
import { useEffect } from "react";

function upsertLink(id: string, href: string) {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;
}

export default function PrimeStyles() {
  useEffect(() => {
    // base styles (safe to load once)
    upsertLink("prime-core-css", PRIME_CORE_CSS_HREF);
    upsertLink("prime-icons-css", PRIME_ICONS_CSS_HREF);

    // theme follows html.dark class (set by next-themes)
    const applyTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      upsertLink(
        PRIME_THEME_LINK_ID,
        isDark ? PRIME_THEME_DARK_HREF : PRIME_THEME_LIGHT_HREF,
      );
    };

    const obs = new MutationObserver(applyTheme);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    applyTheme();

    return () => obs.disconnect();
  }, []);

  return null;
}
