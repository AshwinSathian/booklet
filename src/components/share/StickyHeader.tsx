"use client";

import { useEffect, useState } from "react";

const SCROLL_THRESHOLD = 60;

export function StickyHeader({ children, compact }: { children: React.ReactNode; compact: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-border-subtle bg-bg/85 backdrop-blur-xl print:hidden transition-[padding] duration-200">
      {scrolled ? compact : children}
    </header>
  );
}
