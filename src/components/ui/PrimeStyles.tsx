"use client";

import {
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
  if (link.href !== new URL(href, location.href).href) link.href = href;
}

export default function PrimeStyles() {
  useEffect(() => {
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
