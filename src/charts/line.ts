import {
  ChartResponse,
  LegendOptions,
  LineChartRequest,
  LineSeries,
} from "../types";
import {
  DEFAULT_COLORS,
  areaPath,
  computeYDomain,
  createLinearScale,
  createTimeScale,
  escapeXml,
  formatDateUTC,
  formatNumber,
  isSameUtcDay,
  linePath,
  linearTicks,
  mergeMargins,
  normalizeDimensions,
  parseDate,
  resolveAxisFont,
  timeTicks,
} from "./shared";

function normalizeSeries(series: LineSeries[]): (LineSeries & { parsed: { t: number; v: number }[] })[] {
  return series
    .map((s, idx) => {
      const parsed = s.data
        .map((point) => ({ t: parseDate(point.t), v: Number(point.v) }))
        .filter((p) => Number.isFinite(p.v))
        .sort((a, b) => a.t - b.t);
      return { ...s, color: s.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length], parsed };
    })
    .filter((s) => s.parsed.length > 0);
}

function renderLegend(
  series: { id: string; name?: string; color?: string }[],
  legend: LegendOptions | undefined,
  width: number,
  topOffset: number,
) {
  const show = legend?.show ?? series.length > 1;
  if (!show) return { svg: "", reserved: 0 };
  const fontSize = legend?.fontSize ?? 12;
  const fontFamily = legend?.fontFamily ?? "Inter, system-ui, sans-serif";
  const verticalSpace = fontSize + 10;
  const items = series
    .map(
      (s, idx) =>
        `<g transform="translate(${10 + idx * 140},${topOffset + fontSize})">` +
        `<rect x="0" y="-${fontSize - 4}" width="16" height="6" rx="2" fill="${s.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]}"></rect>` +
        `<text x="24" y="0" font-size="${fontSize}" font-family="${fontFamily}" fill="#111827">${escapeXml(s.name ?? s.id)}</text>` +
        `</g>`,
    )
    .join("");
  const position = legend?.position ?? "top";
  const y = position === "top" ? 8 : 0;
  const reserved = verticalSpace + (position === "bottom" ? 6 : 0);
  const svg = `<g data-legend="true" transform="translate(0,${y})">${items}</g>`;
  return { svg, reserved };
}

export function renderLineChart(request: LineChartRequest): ChartResponse {
  if (!request || !Array.isArray(request.series) || request.series.length === 0) {
    throw new Error("A non-empty series array is required.");
  }

  const series = normalizeSeries(request.series);
  if (series.length === 0) {
    throw new Error("No valid data points found in series.");
  }

  const dims = normalizeDimensions(request.dimensions);
  const legendInfo = renderLegend(series, request.legend, dims.width, 0);
  const margin = mergeMargins({
    ...dims.margin,
    top: dims.margin.top + (legendInfo.reserved || 0),
  });

  const title = request.title ?? "Line chart";
  const desc = request.description ?? "SVG line chart";
  const width = dims.width;
  const height = dims.height;

  const allTimes = series.flatMap((s) => s.parsed.map((p) => p.t));
  const allValues = series.flatMap((s) => s.parsed.map((p) => p.v));
  const xMin = Math.min(...allTimes);
  const xMax = Math.max(...allTimes);
  const yDomain = computeYDomain(allValues, request.y);

  const xScale = createTimeScale([xMin, xMax], [margin.left, width - margin.right]);
  const yScale = createLinearScale(yDomain, [height - margin.bottom, margin.top]);

  const plotWidth = width - margin.left - margin.right;
  const xTicks = timeTicks(xMin, xMax, request.x, plotWidth);
  const yTicks = linearTicks(yDomain, request.y.tickCount ?? 6);

  const { fontFamily: xFontFamily, fontSize: xFontSize } = resolveAxisFont(request.x);
  const { fontFamily: yFontFamily, fontSize: yFontSize } = resolveAxisFont(request.y);

  const gridColor = request.grid?.color ?? "#e5e7eb";
  const gridOpacity = request.grid?.opacity ?? 0.7;
  const background = dims.background ?? "#ffffff";

  const sameDay = isSameUtcDay(xMin, xMax);
  const tickFormat = request.x.format ?? (sameDay ? "%H:%M:%S" : "%b %d");

  const xAxisLabel = request.x.label
    ? `<text x="${(width - margin.left - margin.right) / 2 + margin.left}" y="${height - margin.bottom + 30}" text-anchor="middle" font-family="${xFontFamily}" font-size="${xFontSize + 1}" fill="#111827">${escapeXml(request.x.label)}</text>`
    : "";
  const yAxisLabel = request.y.label
    ? `<text transform="translate(${margin.left - 36}, ${(height - margin.top - margin.bottom) / 2 + margin.top}) rotate(-90)" text-anchor="middle" font-family="${yFontFamily}" font-size="${yFontSize + 1}" fill="#111827">${escapeXml(request.y.label)}</text>`
    : "";

  const seriesPaths = series
    .map((s) => {
      const coords = s.parsed.map((p) => ({ x: xScale(p.t), y: yScale(p.v) }));
      const d = linePath(coords);
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.strokeWidth ?? 2}" stroke-linejoin="round" stroke-linecap="round"></path>`;
    })
    .join("");

  const gridLines = [
    request.grid?.y !== false
      ? yTicks
          .map(
            (t) =>
              `<line x1="${margin.left}" x2="${width - margin.right}" y1="${yScale(t)}" y2="${yScale(t)}" stroke="${gridColor}" stroke-opacity="${gridOpacity}" stroke-width="1"></line>`,
          )
          .join("")
      : "",
    request.grid?.x
      ? xTicks
          .map(
            (t) =>
              `<line x1="${xScale(t.getTime())}" x2="${xScale(t.getTime())}" y1="${height - margin.bottom}" y2="${margin.top}" stroke="${gridColor}" stroke-opacity="${gridOpacity}" stroke-width="1"></line>`,
          )
          .join("")
      : "",
  ].join("");

  const xTickLabels = xTicks
    .map((t) => {
      const x = xScale(t.getTime());
      return `<g transform="translate(${x},${height - margin.bottom})"><line y2="6" stroke="${request.x.tickColor ?? "#111827"}"></line><text fill="#111827" font-family="${xFontFamily}" font-size="${xFontSize}" text-anchor="middle" dy="1.2em">${escapeXml(formatDateUTC(t, tickFormat))}</text></g>`;
    })
    .join("");

  const yTickLabels = yTicks
    .map((t) => {
      const y = yScale(t);
      return `<g transform="translate(${margin.left},${y})"><line x2="-6" stroke="${request.y.tickColor ?? "#111827"}"></line><text fill="#111827" font-family="${yFontFamily}" font-size="${yFontSize}" text-anchor="end" dx="-0.5em" dy="0.32em">${escapeXml(formatNumber(t, request.y.format))}</text></g>`;
    })
    .join("");

  const legend = legendInfo.svg;

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">`,
    `<title>${escapeXml(title)}</title>`,
    `<desc>${escapeXml(desc)}</desc>`,
    `<rect width="100%" height="100%" fill="${background}"></rect>`,
    gridLines ? `<g stroke="${gridColor}" stroke-width="1" stroke-opacity="${gridOpacity}" fill="none">${gridLines}</g>` : "",
    `<g data-axes="true">`,
    `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="${request.x.color ?? "#111827"}" stroke-width="1.2"></line>`,
    `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${margin.left}" y2="${margin.top}" stroke="${request.y.color ?? "#111827"}" stroke-width="1.2"></line>`,
    `<g data-x-ticks="true">${xTickLabels}</g>`,
    `<g data-y-ticks="true">${yTickLabels}</g>`,
    xAxisLabel,
    yAxisLabel,
    `</g>`,
    `<g data-series="true">${seriesPaths}</g>`,
    legend ? `<g data-legend="true">${legend}</g>` : "",
    `</svg>`,
  ]
    .filter(Boolean)
    .join("");

  return { svg, width, height };
}

