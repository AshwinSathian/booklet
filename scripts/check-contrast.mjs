// One-off WCAG contrast verifier for docs/superpowers/specs/2026-07-28-visual-elevation-design.md's
// retuned accent. Run manually: node scripts/check-contrast.mjs
function relLuminance(hex) {
  const c = hex.replace("#", "").match(/.{2}/g).map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(hexA, hexB) {
  const [l1, l2] = [relLuminance(hexA), relLuminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}
const pairs = [
  ["dark accent text on ink-bg", "#c2334a", "#0a0a0c", 4.5],
  ["dark white-on-accent (button label)", "#ffffff", "#c2334a", 4.5],
  ["dark accent-soft on ink-bg", "#ec8a95", "#0a0a0c", 4.5],
  ["light accent text on white", "#c23c50", "#ffffff", 4.5],
  ["light white-on-accent (button label)", "#ffffff", "#c23c50", 4.5],
  ["paper-ink text on paper", "#1d1a14", "#f4ecdc", 4.5],
  ["paper-ink-secondary text on paper", "#5c5546", "#f4ecdc", 4.5],
];
let failed = false;
for (const [label, fg, bg, min] of pairs) {
  const ratio = contrast(fg, bg);
  const pass = ratio >= min;
  if (!pass) failed = true;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${ratio.toFixed(2)}:1 (min ${min}:1)`);
}
process.exit(failed ? 1 : 0);
