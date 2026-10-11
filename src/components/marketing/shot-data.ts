import type { ShotData } from "@/components/marketing/ProductShot";
import { SHOT_SAMPLES } from "@/components/marketing/product-shot-samples";
import { parseFrontmatter } from "@/lib/frontmatter";
import { parseToBlocks } from "@/lib/parse";

/** Every `step`th line end of the source becomes a frame; the last frame is the whole document. */
function build(step = 2): ShotData {
  return SHOT_SAMPLES.map((sample) => {
    const { meta } = parseFrontmatter(sample.source);
    const bodyStart = sample.source.indexOf("\n---\n", 3) + 5;
    const lineEnds: number[] = [];
    for (let i = 0; i < sample.source.length; i++) if (sample.source[i] === "\n") lineEnds.push(i + 1);

    // A table's header row alone parses as a paragraph of pipes: no frame stops between it and its delimiter row.
    const beforeDelimiterRow = (end: number) => /^\s*\|?\s*:?-{3,}/.test(sample.source.slice(end, end + 12));
    const frames = lineEnds
      .filter((end, i) => (i % step === step - 1 || end === sample.source.length) && !beforeDelimiterRow(end))
      .map((chars) => ({
        chars,
        // Until the frontmatter is closed there is no page yet.
        strip: chars >= bodyStart,
        blocks: chars >= bodyStart ? parseToBlocks(sample.source.slice(bodyStart, chars)) : [],
      }));
    return { ...sample, meta: meta as Record<string, unknown>, frames };
  });
}

let cached: ShotData | null = null;
/** The product shot's frames. Parsed once per process: the samples never change at runtime. */
export function getShotData(): ShotData {
  return (cached ??= build());
}
