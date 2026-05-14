import type { SVGProps } from "react";

export type IconName =
  | "plus"
  | "minus"
  | "list"
  | "list-ordered"
  | "upload"
  | "download"
  | "copy"
  | "duplicate"
  | "code"
  | "code-block"
  | "import"
  | "link"
  | "external"
  | "home"
  | "gear"
  | "dots"
  | "check"
  | "close"
  | "pencil"
  | "trash"
  | "spinner"
  | "chevron-down"
  | "chevron-right"
  | "chevron-up"
  | "eye"
  | "eye-off"
  | "chart"
  | "moon"
  | "sun"
  | "print"
  | "toc"
  | "markdown"
  | "bold"
  | "italic"
  | "strikethrough"
  | "quote"
  | "image";

const PATHS: Record<IconName, string | string[]> = {
  plus:           "M8 3v10M3 8h10",
  minus:          "M3 8h10",
  list:           "M3 4h10M3 8h10M3 12h6",
  "list-ordered": "M3 4h10M3 8h10M3 12h6",
  upload:         "M8 11V3M4 7l4-4 4 4M3 13h10",
  download:       "M8 5v8M4 9l4 4 4-4M3 13h10",
  copy:           "M5 5h6v6H5zM9 5V3h4v4h-2M5 9H3v4h4v-2",
  duplicate:      "M5 5h6v6H5zM9 5V3h4v4h-2M5 9H3v4h4v-2",
  code:           "M10 12 13 9 10 6M6 6 3 9l3 3",
  "code-block":   ["M10 12 13 9 10 6M6 6 3 9l3 3", "M3 2h10v2H3zM3 12h10v2H3z"],
  import:         "M8 3v8M5 8l3 3 3-3M3 13h10",
  link:           "M7 9 5 7a2 2 0 1 1 3-3l2 2M9 7l2 2a2 2 0 1 1-3 3L6 10M10 6l-4 4",
  external:       "M11 5H5a1 1 0 0 0-1 1v6M13 3v4M9 3h4v4M7 9l5-5",
  home:           "M2 8 8 3l6 5M4 7v7h3v-4h2v4h3V7",
  gear:           "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M11 11l1 1M3 13l1-1M11 5l1-1",
  dots:           "M4 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0zM7 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0zM10 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0",
  check:          "M3 8l4 4 6-7",
  close:          "M3 3l10 10M13 3 3 13",
  pencil:         "M11 3 13 5 5 13H3v-2L11 3z",
  trash:          "M3 5h10M5 5V3h6v2M6 8v5M10 8v5M4 5l1 8h6l1-8",
  spinner:        "M8 2a6 6 0 0 1 0 12",
  "chevron-down": "M3 6l5 5 5-5",
  "chevron-right":"M6 3l5 5-5 5",
  "chevron-up":   "M3 10l5-5 5 5",
  eye:            ["M1 8C2.5 4.5 5 3 8 3s5.5 1.5 7 5c-1.5 3.5-4 5-7 5S2.5 11.5 1 8z", "M8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"],
  "eye-off":      ["M2 2l12 12", "M1 8C2.5 4.5 5 3 8 3s5.5 1.5 7 5c-1.5 3.5-4 5-7 5S2.5 11.5 1 8z", "M8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"],
  chart:          "M3 13V8M8 13V3M13 13V6M2 13h12",
  moon:           "M12 12A5 5 0 0 1 7 3a7 7 0 1 0 9 9z",
  sun:            "M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M11 11l1 1M3 13l1-1M11 5l1-1M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  print:          "M4 5V2h8v3M3 9h10a1 1 0 0 1 1 1v4H2v-4a1 1 0 0 1 1-1zM4 11h.01M5 13h6v3H5z",
  toc:            "M3 4h1M3 8h1M3 12h1M6 4h7M6 8h5M6 12h3",
  markdown:       "M1 11V5h1.5L4 8l1.5-3H7v6H5.5V7.5L4.5 9.5h-1L2.5 7.5V11H1zM9 11V7H7.5l2.5-3 2.5 3H11v4H9z",
  bold:           "M5 3h4a3 3 0 0 1 0 6H5zM5 9h4.5a3 3 0 0 1 0 6H5z",
  italic:         "M10 3H6M10 13H6M9 3 7 13",
  strikethrough:  "M3 8h10M7 4a2 2 0 0 0-2 2c0 1 .6 1.6 2 2h2c1.4.4 2 1 2 2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2",
  quote:          "M4 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 9v4M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10 9v4",
  image:          "M2 3h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM1 10l4-4 3 3 2-2 4 4",
};

export function Icon({
  name,
  size = 16,
  className,
  ...props
}: {
  name: IconName;
  size?: number;
  className?: string;
} & SVGProps<SVGSVGElement>) {
  const d = PATHS[name];
  const paths = Array.isArray(d) ? d : [d];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={className}
      {...props}
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
