import { renderLineChart } from "./charts/line";
import { renderStackedAreaChart } from "./charts/stacked-area";
import { ChartRequest, LineChartRequest, StackedAreaChartRequest } from "./types";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ROUTES = {
  "/v1/chartgen/line/time": "line",
  "/v1/chartgen/stacked-area/time": "stacked-area",
} as const;

function logError(context: string, err: unknown, extra?: Record<string, unknown>) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  // Cloudflare Workers `console.error` surfaces in the dashboard logs.
  console.error(
    JSON.stringify({
      level: "error",
      context,
      message,
      stack,
      ...extra,
    }),
  );
}

function jsonResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders,
    },
  });
}

function svgResponse(svg: string) {
  return new Response(svg, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "no-store",
      ...corsHeaders,
    },
  });
}

function normalizeDimensionsInput(payload: any) {
  const defaultWidth = 800;
  const defaultHeight = 400;
  const width = Number(payload?.dimensions?.width ?? defaultWidth);
  const height = Number(payload?.dimensions?.height ?? defaultHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error("dimensions.width and dimensions.height must be numbers");
  }
  return {
    width,
    height,
    margin: payload?.dimensions?.margin,
    background: payload?.dimensions?.background,
  };
}

function normalizeLinePayload(body: ChartRequest): LineChartRequest {
  // Support legacy Globadge-style payloads: { options, lines }
  if (!("series" in body) && "lines" in (body as any)) {
    const options = (body as any).options ?? {};
    const lines = Array.isArray((body as any).lines) ? (body as any).lines : [];
    if (lines.length === 0) {
      throw new Error("series is required and must be an array");
    }

    const dimensions = normalizeDimensionsInput({ dimensions: options });
    const x: any = {};
    const y: any = {};
    if (options.xAxis?.label) x.label = options.xAxis.label;
    if (options.timeTicks?.unit) x.unit = options.timeTicks.unit;
    if (options.timeTicks?.format) x.format = options.timeTicks.format;
    if (typeof options.timeTicks?.tickCount === "number") x.tickCount = options.timeTicks.tickCount;
    if (options.yAxis?.label) y.label = options.yAxis.label;
    if (typeof options.yAxis?.tickCount === "number") y.tickCount = options.yAxis.tickCount;
    if (options.yAxis?.format) y.format = options.yAxis.format;

    const series = lines.map((line: any, idx: number) => ({
      id: line.label ?? `series-${idx + 1}`,
      name: line.label,
      color: line.color,
      data: Array.isArray(line.points)
        ? line.points.map((p: any) => ({ t: p.x, v: p.y }))
        : [],
    }));

    return {
      kind: "line",
      dimensions,
      x: x as LineChartRequest["x"],
      y: { tickCount: 6, ...y },
      series,
      grid: {},
      legend: { show: series.length > 1 },
    };
  }

  const dimensions = normalizeDimensionsInput(body);
  if (!Array.isArray((body as any).series)) {
    throw new Error("series is required and must be an array");
  }
  if (!(body as any).y) {
    throw new Error("y axis options are required for line charts");
  }
  return { ...(body as LineChartRequest), dimensions, kind: "line" };
}

function normalizeAreaPayload(body: ChartRequest): StackedAreaChartRequest {
  // Support legacy Globadge-style payloads: { options, areas }
  if (!("series" in body) && "areas" in (body as any)) {
    const options = (body as any).options ?? {};
    const areas = Array.isArray((body as any).areas) ? (body as any).areas : [];
    if (areas.length === 0) {
      throw new Error("series is required and must be an array");
    }

    const dimensions = normalizeDimensionsInput({ dimensions: options });
    const x: any = {};
    const y: any = {};
    if (options.xAxis?.label) x.label = options.xAxis.label;
    if (options.timeTicks?.unit) x.unit = options.timeTicks.unit;
    if (options.timeTicks?.format) x.format = options.timeTicks.format;
    if (typeof options.timeTicks?.tickCount === "number") x.tickCount = options.timeTicks.tickCount;
    if (options.yAxis?.label) y.label = options.yAxis.label;
    if (typeof options.yAxis?.tickCount === "number") y.tickCount = options.yAxis.tickCount;
    if (options.yAxis?.format) y.format = options.yAxis.format;

    const series = areas.map((area: any, idx: number) => ({
      id: area.label ?? `area-${idx + 1}`,
      name: area.label,
      color: area.color,
      opacity: typeof area.opacity === "number" ? area.opacity : undefined,
      data: Array.isArray(area.points)
        ? area.points.map((p: any) => ({ t: p.x, v: p.y }))
        : [],
    }));

    return {
      kind: "stacked-area",
      dimensions,
      x: x as StackedAreaChartRequest["x"],
      y: { tickCount: 6, ...y },
      series,
      grid: {},
      legend: { show: series.length > 1 },
    };
  }

  const dimensions = normalizeDimensionsInput(body);
  if (!Array.isArray((body as any).series)) {
    throw new Error("series is required and must be an array");
  }
  return { ...(body as StackedAreaChartRequest), dimensions, kind: "stacked-area" };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse(405, "Method not allowed");
    }

    const route = ROUTES[url.pathname as keyof typeof ROUTES];
    if (!route) {
      return jsonResponse(404, "Not found");
    }

    let body: ChartRequest;
    try {
      body = await request.json<ChartRequest>();
    } catch (err) {
      logError("json-parse", err, { route: url.pathname });
      return jsonResponse(400, "Invalid JSON body");
    }

    try {
      if (route === "line") {
        const payload = normalizeLinePayload(body);
        const { svg } = renderLineChart(payload);
        return svgResponse(svg);
      }
      if (route === "stacked-area") {
        const payload = normalizeAreaPayload(body);
        const { svg } = renderStackedAreaChart(payload);
        return svgResponse(svg);
      }
      return jsonResponse(404, "Not found");
    } catch (err) {
      logError("render-failure", err, { route, bodyShape: Object.keys(body || {}) });
      const message = err instanceof Error ? err.message : "Unexpected error";
      return jsonResponse(400, message);
    }
  },
};

