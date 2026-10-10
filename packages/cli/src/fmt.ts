import { execFile } from "node:child_process";

export function openUrl(url: string): void {
  // The URL comes from API responses, which may point at a self-hosted or
  // compromised server — never let it reach a shell. Restrict to http(s)
  // and pass it as an argv element (execFile, no shell) so nothing in the
  // string can be interpreted as a shell metacharacter.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return;
  }
  const safeUrl = parsed.toString();

  // On Windows, `start` treats the first quoted arg as the window title,
  // so an empty title string must precede the URL.
  if (process.platform === "darwin") {
    execFile("open", [safeUrl], () => { /* fire and forget */ });
  } else if (process.platform === "win32") {
    execFile("cmd", ["/c", "start", "", safeUrl], () => { /* fire and forget */ });
  } else {
    execFile("xdg-open", [safeUrl], () => { /* fire and forget */ });
  }
}

// ANSI colour helpers — fall back gracefully when NO_COLOR is set, stdout
// isn't a TTY, or the --no-color flag was passed (set via setNoColor()
// from index.ts's preAction hook, since Commander only finishes parsing
// global flags after this module is first imported).
let forcedNoColor = false;

export function setNoColor(value: boolean): void {
  forcedNoColor = value;
}

function colorDisabled(): boolean {
  return forcedNoColor || Boolean(process.env.NO_COLOR) || !process.stdout.isTTY;
}

const c = (code: number, s: string) => (colorDisabled() ? s : `\x1b[${code}m${s}\x1b[0m`);

export const dim = (s: string) => c(2, s);
export const bold = (s: string) => c(1, s);
export const green = (s: string) => c(32, s);
export const red = (s: string) => c(31, s);
export const yellow = (s: string) => c(33, s);
export const cyan = (s: string) => c(36, s);
export const gray = (s: string) => c(90, s);

// --json: the command prints one JSON value on stdout (emit) and nothing
// else there; human-readable lines are dropped. Warnings and errors still
// go to stderr.
let jsonMode = false;

export function setJson(value: boolean): void {
  jsonMode = value;
}

export function isJson(): boolean {
  return jsonMode;
}

/** The command's result, printed only under --json. */
export function emit(data: unknown): void {
  if (jsonMode) console.log(JSON.stringify(data, null, 2));
}

/** A plain human-readable line, dropped under --json. */
export function print(msg = ""): void {
  if (!jsonMode) console.log(msg);
}

export function success(msg: string) {
  print(`${green("✓")} ${msg}`);
}

export function info(msg: string) {
  print(`${cyan("→")} ${msg}`);
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
    print(dim("(no results)"));
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

  print(headerRow);
  print(dim(divider));
  for (const row of dataRows) {
    print(row);
  }
}
