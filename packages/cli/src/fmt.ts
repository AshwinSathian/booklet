import { exec } from "node:child_process";

export function openUrl(url: string): void {
  // On Windows, `start` treats the first quoted arg as the window title,
  // so an empty title string must precede the URL.
  const cmd =
    process.platform === "darwin" ? `open "${url}"`
    : process.platform === "win32" ? `start "" "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, () => { /* fire and forget */ });
}

// ANSI colour helpers — fall back gracefully when NO_COLOR is set
const NO_COLOR = Boolean(process.env.NO_COLOR) || !process.stdout.isTTY;

const c = (code: number, s: string) => (NO_COLOR ? s : `\x1b[${code}m${s}\x1b[0m`);

export const dim = (s: string) => c(2, s);
export const bold = (s: string) => c(1, s);
export const green = (s: string) => c(32, s);
export const red = (s: string) => c(31, s);
export const yellow = (s: string) => c(33, s);
export const cyan = (s: string) => c(36, s);
export const gray = (s: string) => c(90, s);

export function success(msg: string) {
  console.log(`${green("✓")} ${msg}`);
}

export function info(msg: string) {
  console.log(`${cyan("→")} ${msg}`);
}

export function warn(msg: string) {
  console.warn(`${yellow("!")} ${msg}`);
}

export function error(msg: string) {
  console.error(`${red("✗")} ${msg}`);
}

type Row = (string | number | null | undefined)[];

export function table(headers: string[], rows: Row[]) {
  if (rows.length === 0) {
    console.log(dim("(no results)"));
    return;
  }

  // Compute column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)),
  );

  const divider = widths.map((w) => "─".repeat(w + 2)).join("┼");
  const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));

  const headerRow = widths
    .map((w, i) => ` ${bold(pad(headers[i], w))} `)
    .join("│");
  const dataRows = rows.map((row) =>
    widths.map((w, i) => ` ${pad(String(row[i] ?? ""), w)} `).join("│"),
  );

  console.log(headerRow);
  console.log(dim(divider));
  for (const row of dataRows) {
    console.log(row);
  }
}
