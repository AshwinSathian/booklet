export type GraphPoint = { x: number; y: number };

/**
 * A small, dependency-free force-directed layout (Fruchterman-Reingold
 * style) — not worth pulling in d3-force for what's a few dozen to a few
 * hundred nodes, computed once (not animated frame-by-frame) for the
 * private graph view. O(n^2) per iteration, which is fine at this scale;
 * a real "second brain" plugin ecosystem would swap this for something
 * smarter long before it stopped being fine.
 */
export function computeForceLayout(
  nodeIds: string[],
  edges: { source: string; target: string }[],
  opts?: { width?: number; height?: number; iterations?: number },
): Record<string, GraphPoint> {
  const width = opts?.width ?? 640;
  const height = opts?.height ?? 640;
  const iterations = opts?.iterations ?? 150;

  const n = nodeIds.length;
  const pos: Record<string, GraphPoint> = {};
  if (n === 0) return pos;

  // Deterministic-ish initial placement on a circle (not random) so the
  // layout is stable across re-renders of the same vault instead of
  // jittering every time the dialog reopens.
  const radius = Math.min(width, height) / 2.5;
  nodeIds.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / n;
    pos[id] = {
      x: width / 2 + radius * Math.cos(angle),
      y: height / 2 + radius * Math.sin(angle),
    };
  });

  if (n === 1) return pos;

  const area = width * height;
  const k = Math.sqrt(area / n);
  const disp: Record<string, GraphPoint> = {};

  for (let iter = 0; iter < iterations; iter++) {
    for (const id of nodeIds) disp[id] = { x: 0, y: 0 };

    // Repulsion between every pair.
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodeIds[i];
        const b = nodeIds[j];
        let dx = pos[a].x - pos[b].x;
        let dy = pos[a].y - pos[b].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        disp[a].x += dx;
        disp[a].y += dy;
        disp[b].x -= dx;
        disp[b].y -= dy;
      }
    }

    // Attraction along edges.
    for (const { source, target } of edges) {
      if (source === target || !pos[source] || !pos[target]) continue;
      const dx = pos[source].x - pos[target].x;
      const dy = pos[source].y - pos[target].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      const ux = (dx / dist) * force;
      const uy = (dy / dist) * force;
      disp[source].x -= ux;
      disp[source].y -= uy;
      disp[target].x += ux;
      disp[target].y += uy;
    }

    // Cool down linearly and clamp displacement + bounds.
    const temperature = width * (1 - iter / iterations) * 0.05;
    for (const id of nodeIds) {
      const d = disp[id];
      const len = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
      const capped = Math.min(len, temperature);
      pos[id] = {
        x: Math.min(width, Math.max(0, pos[id].x + (d.x / len) * capped)),
        y: Math.min(height, Math.max(0, pos[id].y + (d.y / len) * capped)),
      };
    }
  }

  return pos;
}
