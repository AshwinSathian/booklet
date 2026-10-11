import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { buildOgSvg } from "@/lib/og-image";

// A page's title is whatever its author typed. The card has to draw for all of them.

const TITLES = [
  // An ampersand where the title is cut: escaping before cutting split the entity.
  `${"a".repeat(49)}&${"b".repeat(20)}`,
  `${"a".repeat(30)}&${"b".repeat(10)}`,
  `<script>alert("x")</script> & 'quotes'`,
  "<!DOCTYPE x [<!ENTITY y SYSTEM \"file:///etc/passwd\">]> &y;",
  "control\u000bcharacters\u001bhere",
  "    ",
  "日本語のタイトル: データベースのフェイルオーバー手順",
];

for (const [i, title] of TITLES.entries()) {
  test(`a card is drawn for hostile title ${i + 1}`, async () => {
    const svg = buildOgSvg(title, "Incident & <report>", "Published with Booklet");
    // Every ampersand left in the SVG starts one of the five entities.
    expect(svg.replace(/&(amp|lt|gt|quot|apos);/g, "")).not.toContain("&");
    // It has to render: an SVG that is not well-formed XML throws here.
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const { width, height, format } = await sharp(png).metadata();
    expect({ width, height, format }).toEqual({ width: 1200, height: 630, format: "png" });
  });
}
