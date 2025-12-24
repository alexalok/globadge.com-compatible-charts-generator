import { ChartRequest, Env } from "./types";
import { generateChart, ChartType } from "./services/chart-service";
import { saveChart, getChart, deleteChartsOlderThan } from "./services/storage-service";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ROUTES = {
  "/v1/chartgen/line/time": "line",
  "/v1/chartgen/stacked-area/time": "stacked-area",
} as const;

const DEFAULT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

function logError(context: string, err: unknown, extra?: Record<string, unknown>) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
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

function jsonResponse(status: number, data: any) {
  return new Response(JSON.stringify(data), {
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

function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function parseRetentionMs(raw?: string): number {
  if (!raw) {
    return DEFAULT_RETENTION_MS;
  }
  const trimmed = raw.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)\s*(y|w|d|h|m)$/);
  if (!match) {
    throw new Error("CHART_RETENTION_MAX_AGE must look like '30d', '12w', or '1y'");
  }
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = {
    m: 60 * 1000, // minutes
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
  };
  return value * unitMs[unit];
}

function getRetentionMs(env: Env): number {
  try {
    return parseRetentionMs(env.CHART_RETENTION_MAX_AGE);
  } catch (err) {
    logError("invalid-retention", err, { raw: env.CHART_RETENTION_MAX_AGE });
    return DEFAULT_RETENTION_MS;
  }
}

async function purgeOldCharts(env: Env, retentionMs: number) {
  const startedAt = Date.now();
  const result = await deleteChartsOlderThan(env.CHARTS_BUCKET, retentionMs);
  const durationMs = Date.now() - startedAt;
  console.log(
    JSON.stringify({
      level: "info",
      context: "purge-old-charts",
      retentionMs,
      ...result,
      durationMs,
    }),
  );
  return result;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // Handle GET requests for stored charts
    // Pattern: /v1/chartgen/{type}/time/{id}
    const getMatch = url.pathname.match(
      /^\/v1\/chartgen\/(line|stacked-area)\/time\/(chart_[a-z_]+_[0-9a-f-]+)$/,
    );
    if (getMatch && request.method === "GET") {
      const [, chartTypeRaw, id] = getMatch;
      const chartType = chartTypeRaw === "line" ? "line" : "stacked-area";

      try {
        const svg = await getChart(env.CHARTS_BUCKET, chartType, id);
        if (!svg) {
          return jsonResponse(404, { error: "Chart not found" });
        }
        return svgResponse(svg);
      } catch (err) {
        logError("get-chart", err, { chartType, id });
        return jsonResponse(500, { error: "Failed to retrieve chart" });
      }
    }

    // Handle POST and PUT requests for chart generation
    const route = ROUTES[url.pathname as keyof typeof ROUTES];
    if (!route) {
      return jsonResponse(404, { error: "Not found" });
    }

    if (request.method !== "POST" && request.method !== "PUT") {
      return jsonResponse(405, { error: "Method not allowed" });
    }

    let body: ChartRequest;
    try {
      body = await request.json<ChartRequest>();
    } catch (err) {
      logError("json-parse", err, { route: url.pathname });
      return jsonResponse(400, { error: "Invalid JSON body" });
    }

    try {
      const chartType = route as ChartType;
      const { svg } = generateChart(chartType, body);

      // POST: Return SVG directly
      if (request.method === "POST") {
        return svgResponse(svg);
      }

      // PUT: Save to R2 and return JSON with id and url
      if (request.method === "PUT") {
        const baseUrl = getBaseUrl(request);
        const stored = await saveChart(env.CHARTS_BUCKET, chartType, svg, baseUrl);
        return jsonResponse(200, stored);
      }

      return jsonResponse(405, { error: "Method not allowed" });
    } catch (err) {
      logError("render-failure", err, { route, bodyShape: Object.keys(body || {}) });
      const message = err instanceof Error ? err.message : "Unexpected error";
      return jsonResponse(400, { error: message });
    }
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const retentionMs = getRetentionMs(env);
    ctx.waitUntil(
      purgeOldCharts(env, retentionMs).catch((err) => {
        logError("cron-purge-failed", err, { retentionMs });
      }),
    );
  },
};
