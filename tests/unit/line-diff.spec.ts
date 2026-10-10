import { test, expect } from "@playwright/test";
import { diffLines } from "@/lib/line-diff";

const ops = (before: string, after: string) => diffLines(before, after).map((l) => `${l.op[0]}:${l.text}`);

test.describe("diffLines", () => {
  test("identical texts are all 'same'", () => {
    expect(ops("a\nb", "a\nb")).toEqual(["s:a", "s:b"]);
  });

  test("a changed line in the middle is one removal and one addition", () => {
    expect(ops("---\ntitle: A\n---\nbody", "---\ntitle: B\n---\nbody")).toEqual([
      "s:---",
      "d:title: A",
      "a:title: B",
      "s:---",
      "s:body",
    ]);
  });

  test("insertions and deletions keep the lines around them", () => {
    expect(ops("a\nb\nc\nd", "a\nc\nx\nd")).toEqual(["s:a", "d:b", "s:c", "a:x", "s:d"]);
  });

  test("applying the diff to the first text gives the second", () => {
    const before = "one\ntwo\nthree\ntwo\nfour";
    const after = "two\nthree\nfive\ntwo\nfour\nsix";
    const d = diffLines(before, after);
    expect(d.filter((l) => l.op !== "add").map((l) => l.text).join("\n")).toBe(before);
    expect(d.filter((l) => l.op !== "del").map((l) => l.text).join("\n")).toBe(after);
  });

  test("a middle too large for the table still gives a correct, coarser diff", () => {
    const before = Array.from({ length: 2500 }, (_, i) => `a${i}`).join("\n");
    const after = Array.from({ length: 2500 }, (_, i) => `b${i}`).join("\n");
    const d = diffLines(`top\n${before}\nend`, `top\n${after}\nend`);
    expect(d[0]).toEqual({ op: "same", text: "top" });
    expect(d.at(-1)).toEqual({ op: "same", text: "end" });
    expect(d.filter((l) => l.op === "del")).toHaveLength(2500);
    expect(d.filter((l) => l.op === "add")).toHaveLength(2500);
  });
});
