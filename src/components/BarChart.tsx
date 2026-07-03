/**
 * Minimal SVG bar chart — single or grouped multi-series. No charting
 * library: this app has none, and everything else here is plain
 * Tailwind/HTML, so a small hand-built primitive fits rather than adding a
 * dependency for two charts. Colors are fixed categorical slots from the
 * data-viz skill's pre-validated reference palette, assigned in a stable
 * order (never cycled). Native <title> elements give baseline hover
 * tooltips, proportionate to this app's scale.
 */

export interface BarChartSeries {
  label: string;
  color: string;
  values: number[];
}

function roundedTopRectPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0 || w <= 0) return '';
  const radius = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + radius} Q${x},${y} ${x + radius},${y} L${x + w - radius},${y} Q${x + w},${y} ${x + w},${y + radius} L${x + w},${y + h} Z`;
}

export function BarChart({
  categories,
  series,
  formatValue = (v: number) => String(v),
  height = 200,
  showValueLabels = true,
}: {
  categories: string[];
  series: BarChartSeries[];
  formatValue?: (v: number) => string;
  height?: number;
  showValueLabels?: boolean;
}) {
  const width = 640;
  const padding = { top: 24, right: 8, bottom: 28, left: 8 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const groupW = plotW / categories.length;
  const barGap = 3;
  const barW = (groupW - barGap * (series.length + 1)) / series.length;

  return (
    <div className="w-full">
      {series.length > 1 && (
        <div className="mb-2 flex gap-4 text-xs text-slate-600">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
        <line
          x1={padding.left}
          y1={padding.top + plotH}
          x2={padding.left + plotW}
          y2={padding.top + plotH}
          stroke="#e2e8f0"
          strokeWidth={1}
        />
        {categories.map((cat, i) => {
          const groupX = padding.left + i * groupW;
          return (
            <g key={cat}>
              {series.map((s, si) => {
                const value = s.values[i] ?? 0;
                const h = (value / max) * plotH;
                const x = groupX + barGap + si * (barW + barGap);
                const y = padding.top + plotH - h;
                return (
                  <g key={s.label}>
                    <path d={roundedTopRectPath(x, y, barW, h, 3)} fill={s.color}>
                      <title>
                        {cat} — {s.label}: {formatValue(value)}
                      </title>
                    </path>
                    {showValueLabels && series.length === 1 && value > 0 && (
                      <text
                        x={x + barW / 2}
                        y={y - 4}
                        textAnchor="middle"
                        className="fill-slate-600"
                        fontSize={9}
                      >
                        {formatValue(value)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={groupX + groupW / 2}
                y={height - 10}
                textAnchor="middle"
                className="fill-slate-500"
                fontSize={10}
              >
                {cat}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
