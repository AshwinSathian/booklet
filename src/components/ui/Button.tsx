"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const BASE =
  "inline-flex items-center justify-center font-semibold rounded-pill transition " +
  "active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const VARIANTS = {
  primary: "bg-accent text-white shadow-soft hover:bg-accent-hover",
  secondary: "border border-outline text-text-secondary hover:border-accent-soft/50 hover:text-text-primary",
  danger: "border border-red-400/40 text-red-400 hover:bg-red-400/10",
  ghost: "text-text-muted hover:text-text-primary hover:bg-fill-2",
} as const;

const SIZES_TEXT = {
  sm: "h-7 gap-1 px-3 text-2xs",
  md: "h-8 gap-1.5 px-3.5 text-xs",
  lg: "h-10 gap-2 px-5 text-sm",
  xl: "h-12 gap-2 px-7 text-[15px]",
} as const;

const SIZES_ICON = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES_TEXT;

function cls(
  variant: ButtonVariant,
  size: ButtonSize,
  iconOnly: boolean,
  extra?: string,
) {
  return [
    BASE,
    VARIANTS[variant],
    iconOnly ? SIZES_ICON[size] : SIZES_TEXT[size],
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Button component
// ---------------------------------------------------------------------------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  href?: string;
  external?: boolean;
  className?: string;
  children?: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  iconOnly = false,
  href,
  external,
  className,
  children,
  ...rest
}: ButtonProps) {
  const computed = cls(variant, size, iconOnly, className);

  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={computed}>
        {children}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={computed}>
        {children}
      </Link>
    );
  }
  return (
    <button className={computed} {...rest}>
      {children}
    </button>
  );
}
