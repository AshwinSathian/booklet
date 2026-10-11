// WCAG AA contrast check for every colour token text is drawn in: the app's
// dark and light palettes (src/app/globals.css), each document theme
// (src/lib/themes.ts) and the syntax-highlight colours. Each text token is
// checked against every surface it is used on, tints included.
//
//   node scripts/check-contrast.mjs
//
// Exits 1 if any pair is under 4.5:1. tests/e2e/accessibility-routes.spec.ts
// runs axe over the rendered pages; this covers the themes and surface
// combinations those pages do not happen to show.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MIN = 4.5;
const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

export function parseColor(value) {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (hex) return [...hex[1].match(/.{2}/g).map((h) => parseInt(h, 16)), 1];
  const rgba = /^rgba?\(([^)]+)\)$/.exec(value.trim());
  if (!rgba) throw new Error(`Unreadable colour: ${value}`);
  const [r, g, b, a = 1] = rgba[1].split(",").map(Number);
  return [r, g, b, a];
}
/** `top` (which may be translucent) drawn over the opaque `under`. */
export function over(top, under) {
  const [r, g, b, a] = parseColor(top);
  const [ur, ug, ub] = parseColor(under);
  const mix = (c, u) => Math.round(c * a + u * (1 - a));
  return `#${[mix(r, ur), mix(g, ug), mix(b, ub)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function luminance(hex) {
  const [r, g, b] = parseColor(hex).slice(0, 3).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `--name: value;` declarations in a block of CSS or of a theme object. */
function declarations(block) {
  const out = {};
  for (const m of block.matchAll(/["']?(--[a-z0-9-]+)["']?\s*:\s*["']?(#[0-9a-fA-F]{6}|rgba?\([^)]*\))/g)) out[m[1]] = m[2];
  return out;
}
/** The body of the first `{ ... }` after `marker`. */
function blockAfter(source, marker, from = 0) {
  const start = source.indexOf("{", source.indexOf(marker, from));
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(start + 1, i);
  }
  throw new Error(`No block after ${marker}`);
}

/** Every palette as { name, vars }, with the app's values filling what a theme does not set. */
export function palettes() {
  const css = read("src/app/globals.css");
  const hljsAt = css.indexOf("--hljs-fg");
  // :root holds the light palette; html.dark overrides it.
  const app = {
    light: { ...declarations(blockAfter(css, "\n:root {")), ...declarations(blockAfter(css, "\n:root {", hljsAt - 200)) },
    dark: {},
  };
  app.dark = { ...app.light, ...declarations(blockAfter(css, "\nhtml.dark {")), ...declarations(blockAfter(css, "\nhtml.dark {", hljsAt - 200)) };
  if (app.dark["--color-bg"] === app.light["--color-bg"]) throw new Error("The dark palette was not read: both themes have the same --color-bg.");

  const out = [{ name: "app dark", vars: app.dark }, { name: "app light", vars: app.light }];
  const themes = read("src/lib/themes.ts");
  for (const m of themes.matchAll(/\bid: "([a-z-]+)"/g)) {
    for (const mode of ["dark", "light"]) {
      out.push({ name: `theme ${m[1]} ${mode}`, vars: { ...app[mode], ...declarations(blockAfter(themes, `${mode}: {`, m.index)) } });
    }
  }
  return out;
}

/** [token, surface label, surface colour] for every text-on-surface pair in a palette. */
export function pairs(v) {
  const bg = v["--color-bg"];
  const elevated = v["--color-bg-elevated"];
  const surfaces = {
    bg,
    "bg-soft": v["--color-bg-soft"],
    "bg-elevated": elevated,
    "fill-2 on bg": over(v["--color-fill-2"], bg),
    "fill-2 on bg-elevated": over(v["--color-fill-2"], elevated),
    "fill-3 on bg-elevated": over(v["--color-fill-3"], elevated),
    "accent-dim on bg": over(v["--color-accent-dim"], bg),
    "accent-dim on bg-elevated": over(v["--color-accent-dim"], elevated),
  };
  const text = ["--color-text-secondary", "--color-text-muted", "--color-accent", "--color-accent-soft"];
  const out = text.flatMap((token) => Object.entries(surfaces).map(([label, colour]) => [token, label, colour]));
  // Status text: on the plain surfaces and on its own 15% tint over them
  // (callouts, badges, error boxes).
  for (const token of ["--color-danger", "--color-success", "--color-warning", "--color-info", "--color-special"]) {
    const [r, g, b] = parseColor(v[token]);
    const tint = `rgba(${r}, ${g}, ${b}, 0.15)`;
    out.push(
      [token, "bg", bg],
      [token, "bg-soft", v["--color-bg-soft"]],
      [token, "bg-elevated", elevated],
      [token, "own 15% tint on bg", over(tint, bg)],
      [token, "own 15% tint on bg-elevated", over(tint, elevated)],
    );
  }
  // A label on an accent-filled button, and ink on the highlighter.
  out.push(["--color-accent-contrast", "accent", v["--color-accent"]]);
  out.push(["--color-accent-contrast", "accent-hover", v["--color-accent-hover"]]);
  out.push(["--color-on-highlight", "highlight", v["--color-highlight"]]);
  // Highlighted code is drawn on bg-elevated (CodeBlock).
  for (const token of Object.keys(v).filter((k) => k.startsWith("--hljs-"))) out.push([token, "bg-elevated", elevated]);
  return out;
}

export function failures() {
  return palettes().flatMap(({ name, vars }) =>
    pairs(vars)
      .map(([token, label, surface]) => ({ palette: name, token, value: vars[token], label, surface, ratio: contrast(vars[token], surface) }))
      .filter((p) => p.ratio < MIN),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failed = failures();
  for (const f of failed) {
    console.log(`FAIL  ${f.palette}: ${f.token} ${f.value} on ${f.label} ${f.surface} is ${f.ratio.toFixed(2)}:1 (min ${MIN}:1)`);
  }
  const total = palettes().reduce((n, p) => n + pairs(p.vars).length, 0);
  console.log(failed.length ? `${failed.length} of ${total} pairs fail.` : `PASS  all ${total} pairs are at least ${MIN}:1.`);
  process.exit(failed.length ? 1 : 0);
}
