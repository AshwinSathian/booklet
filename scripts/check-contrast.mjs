// One-off WCAG contrast verifier for the Precision redesign's accent palette
// (see docs/superpowers/sdd/2026-08-01-precision-redesign). Run manually:
// node scripts/check-contrast.mjs
function relLuminance(hex) {
  const c = hex.replace("#", "").match(/.{2}/g).map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(hexA, hexB) {
  const [l1, l2] = [relLuminance(hexA), relLuminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}
const PAIRS = [
  // [label, fg, bg, minRatio]
  ["dark: accent text/icon on bg",        "#f5a623", "#0a0a0a", 4.5],
  ["dark: accent-contrast on accent bg",  "#0a0a0a", "#f5a623", 4.5],
  ["dark: accent-soft on bg",             "#f8c368", "#0a0a0a", 4.5],
  ["light: accent text/icon on bg",       "#8a5a00", "#fafafa", 4.5],
  ["light: accent-contrast on accent bg", "#fafafa", "#8a5a00", 4.5],
  ["light: accent-soft on bg",            "#9e680a", "#fafafa", 4.5],
];
// NOTE: light-mode accent-soft above (#9e680a) is tuned darker than the
// #a8720a landed in src/app/globals.css by Task 1 — #a8720a measures
// 3.96:1 against #fafafa and fails the 4.5:1 AA bar. globals.css needs to
// be updated to #9e680a (4.53:1) to match; flagging for product-owner
// awareness rather than silently diverging from the plan's stated value.

let failed = false;
for (const [label, fg, bg, min] of PAIRS) {
  const ratio = contrast(fg, bg);
  const pass = ratio >= min;
  if (!pass) failed = true;
  const status = pass ? "PASS" : "FAIL";
  console.log(`${status}  ${label}: ${ratio.toFixed(2)}:1 (min ${min}:1)`);
}
process.exit(failed ? 1 : 0);
