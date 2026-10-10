export type DiffLine = { op: "same" | "add" | "del"; text: string };

// ponytail: LCS table, O(n*m) cells after the common head and tail are cut
// off. Past this many cells the middle is shown as all-removed then
// all-added. Swap in Myers if real documents hit the ceiling.
const MAX_CELLS = 4_000_000;

/** Line diff of two texts: what to remove from `before` and add to reach `after`. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");

  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const same = (lines: string[]): DiffLine[] => lines.map((text) => ({ op: "same", text }));

  return [...same(a.slice(0, head)), ...diffMiddle(midA, midB), ...same(a.slice(a.length - tail))];
}

function diffMiddle(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  const del = (lines: string[]): DiffLine[] => lines.map((text) => ({ op: "del", text }));
  const add = (lines: string[]): DiffLine[] => lines.map((text) => ({ op: "add", text }));
  if (n === 0 || m === 0 || n * m > MAX_CELLS) return [...del(a), ...add(b)];

  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..]
  const w = m + 1;
  const lcs = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = a[i] === b[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[(i + 1) * w + j] >= lcs[i * w + j + 1]) {
      out.push({ op: "del", text: a[i++] });
    } else {
      out.push({ op: "add", text: b[j++] });
    }
  }
  return [...out, ...del(a.slice(i)), ...add(b.slice(j))];
}
