"use client";

import { useId, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";

type DayPoint = { date: string; views: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Parsed manually (not via `new Date(...)`) so a UTC "YYYY-MM-DD" day never
// shifts by a day under a negative local timezone offset.
function formatDay(dateStr: string, withYear = false): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const label = `${MONTHS[m - 1]} ${d}`;
  return withYear ? `${label}, ${y}` : label;
}

// Classic "nice numbers" axis algorithm (Heckbert) so y-axis ticks land on
// clean round values (0 / 5 / 10, 0 / 50 / 100, …) rather than the raw max.
function niceNum(range: number, round: boolean): number {
  if (range <= 0) return 1;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / 10 ** exponent;
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * 10 ** exponent;
}

function computeYAxis(maxValue: number, tickIntervals = 3): { axisMax: number; ticks: number[] } {
  if (maxValue <= 0) {
    return { axisMax: tickIntervals, ticks: Array.from({ length: tickIntervals + 1 }, (_, i) => i) };
  }
  const niceRange = niceNum(maxValue, false);
  // Views are whole numbers: a step under 1 would round two ticks to the same value.
  const step = Math.max(1, niceNum(niceRange / tickIntervals, true));
  const axisMax = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= axisMax + step / 2; v += step) ticks.push(Math.round(v));
  return { axisMax, ticks };
}

const VB_WIDTH = 720;
const VB_HEIGHT = 220;
// Axis labels are HTML laid over the chart, so they keep their size when the
// SVG scales down on a phone; the plot needs no room for them.
const MARGIN = { top: 8, right: 4, bottom: 4, left: 4 };
const PLOT_WIDTH = VB_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = VB_HEIGHT - MARGIN.top - MARGIN.bottom;

/**
 * Single-series (page views/day) trend chart. Hand-rolled SVG rather than a
 * charting dependency — the data shape (one series, ~30 points) doesn't
 * warrant the bundle cost of recharts/visx for one dashboard.
 */
export function ViewsChart({ data }: { data: DayPoint[] }) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const n = data.length;
  const maxViews = useMemo(() => Math.max(0, ...data.map((d) => d.views)), [data]);
  const { axisMax, ticks } = useMemo(() => computeYAxis(maxViews), [maxViews]);

  const xAt = (i: number) => MARGIN.left + (n <= 1 ? 0 : (i / (n - 1)) * PLOT_WIDTH);
  const yAt = (v: number) => MARGIN.top + PLOT_HEIGHT - (axisMax <= 0 ? 0 : (v / axisMax) * PLOT_HEIGHT);

  // Cheap enough (~30 points) to recompute directly each render rather than
  // memoize against the non-memoized xAt/yAt closures.
  const linePoints = data.map((d, i) => `${xAt(i)},${yAt(d.views)}`).join(" ");
  const areaPoints = n > 0 ? `${xAt(0)},${yAt(0)} ${linePoints} ${xAt(n - 1)},${yAt(0)}` : "";

  // Sparse x-axis ticks: evenly spaced indices, first/last always included.
  const xTickIndices = useMemo(() => {
    if (n <= 1) return [0];
    const count = Math.min(6, n);
    const idxs = new Set<number>();
    for (let k = 0; k < count; k++) idxs.add(Math.round((k / (count - 1)) * (n - 1)));
    return Array.from(idxs).sort((a, b) => a - b);
  }, [n]);

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VB_WIDTH;
    const fraction = (px - MARGIN.left) / PLOT_WIDTH;
    const idx = Math.round(fraction * (n - 1));
    setHoverIndex(Math.min(n - 1, Math.max(0, idx)));
  };

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const hoverX = hoverIndex !== null ? xAt(hoverIndex) : 0;
  const hoverY = hoverIndex !== null && hovered ? yAt(hovered.views) : 0;

  // Tooltip placement as a % of the chart width, flipped near the edges so it
  // never overflows the card.
  const tooltipLeftPct = (hoverX / VB_WIDTH) * 100;
  const tooltipAlign: "left" | "center" | "right" =
    tooltipLeftPct < 15 ? "left" : tooltipLeftPct > 85 ? "right" : "center";

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        className="block w-full touch-none"
        style={{ aspectRatio: `${VB_WIDTH} / ${VB_HEIGHT}` }}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
        role="img"
        aria-label={`Views for the last ${n} days, peak day ${maxViews.toLocaleString("en-US")} views`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={MARGIN.left}
              x2={VB_WIDTH - MARGIN.right}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="var(--color-border-subtle)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {/* Baseline */}
        <line
          x1={MARGIN.left}
          x2={VB_WIDTH - MARGIN.right}
          y1={yAt(0)}
          y2={yAt(0)}
          stroke="var(--color-border-default)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />


        {/* Area wash + line */}
        {n > 0 && (
          <>
            <polygon points={areaPoints} fill={`url(#${gradientId})`} stroke="none" />
            <polyline
              points={linePoints}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

        {/* Hover crosshair + marker */}
        {hovered && (
          <>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={MARGIN.top}
              y2={VB_HEIGHT - MARGIN.bottom}
              stroke="var(--color-border-default)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={hoverX} cy={hoverY} r={5} fill="var(--color-bg-elevated)" />
            <circle cx={hoverX} cy={hoverY} r={3.5} fill="var(--color-accent)" />
          </>
        )}
      </svg>

      {/* Y-axis values, each under its gridline */}
      <div data-y-axis className="pointer-events-none absolute inset-x-0 top-0" style={{ aspectRatio: `${VB_WIDTH} / ${VB_HEIGHT}` }} aria-hidden>
        {ticks.slice(1).map((t) => (
          <span
            key={t}
            className="absolute pt-0.5 text-xs tabular-nums text-text-muted"
            style={{ left: `${(MARGIN.left / VB_WIDTH) * 100}%`, top: `${(yAt(t) / VB_HEIGHT) * 100}%` }}
          >
            {t.toLocaleString("en-US")}
          </span>
        ))}
      </div>

      {/* X-axis dates: the first and last are pinned to the edges so neither is cut off */}
      <div className="relative mt-1.5 h-4 text-xs text-text-muted" aria-hidden>
        {xTickIndices.map((i, k) => (
          <span
            key={i}
            className={[
              "absolute top-0 whitespace-nowrap",
              k === 0 ? "" : k === xTickIndices.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
              // A phone has room for three dates: the ends and the middle.
              k === 0 || k === xTickIndices.length - 1 || k === Math.floor((xTickIndices.length - 1) / 2) ? "" : "max-sm:hidden",
            ].join(" ")}
            style={{ left: `${(xAt(i) / VB_WIDTH) * 100}%` }}
          >
            {formatDay(data[i].date)}
          </span>
        ))}
      </div>

      {hovered && (
        <div
          className="pointer-events-none absolute top-1 z-10 whitespace-nowrap rounded-md border border-border-default bg-bg-elevated px-2.5 py-1.5 text-xs shadow-card"
          style={{
            left: `${tooltipLeftPct}%`,
            transform:
              tooltipAlign === "left"
                ? "translateX(0)"
                : tooltipAlign === "right"
                  ? "translateX(-100%)"
                  : "translateX(-50%)",
          }}
        >
          <div className="text-text-muted">{formatDay(hovered.date, true)}</div>
          <div className="font-semibold tabular-nums text-text-primary">
            {hovered.views.toLocaleString("en-US")} {hovered.views === 1 ? "view" : "views"}
          </div>
        </div>
      )}

      {/* Accessible table twin — same data, screen-reader only */}
      <table className="sr-only">
        <caption>Daily page views, last {n} days</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Views</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{formatDay(d.date, true)}</td>
              <td>{d.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
