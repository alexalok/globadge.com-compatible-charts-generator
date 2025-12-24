import { ChartType } from "./chart-service";

function generateChartId(chartType: ChartType): string {
  const prefix = chartType === "line" ? "chart_line_time" : "chart_stacked_area_time";
  const uuid = crypto.randomUUID();
  return `${prefix}_${uuid}`;
}

export interface StoredChart {
  id: string;
  url: string;
}

export async function saveChart(
  bucket: R2Bucket,
  chartType: ChartType,
  svg: string,
  baseUrl: string,
): Promise<StoredChart> {
  const id = generateChartId(chartType);
  const key = `${chartType}/${id}.svg`;

  // Store the SVG in R2
  await bucket.put(key, svg, {
    httpMetadata: {
      contentType: "image/svg+xml",
      cacheControl: "public, max-age=31536000", // Cache for 1 year
    },
  });

  // Construct the public URL based on chart type
  const chartPath = chartType === "line" ? "line/time" : "stacked-area/time";
  const url = `${baseUrl}/v1/chartgen/${chartPath}/${id}`;

  return { id, url };
}

export async function getChart(
  bucket: R2Bucket,
  chartType: ChartType,
  id: string,
): Promise<string | null> {
  const key = `${chartType}/${id}.svg`;
  const object = await bucket.get(key);

  if (!object) {
    return null;
  }

  return await object.text();
}

export interface DeleteOldChartsResult {
  deleted: number;
  scanned: number;
}

/**
 * Remove charts older than the provided age, based on the R2 object's uploaded time.
 */
export async function deleteChartsOlderThan(
  bucket: R2Bucket,
  maxAgeMs: number,
): Promise<DeleteOldChartsResult> {
  const now = Date.now();
  let cursor: string | undefined;
  let deleted = 0;
  let scanned = 0;

  do {
    const page = await bucket.list({ cursor, limit: 1000 });
    for (const obj of page.objects) {
      scanned += 1;
      const uploadedAt = obj.uploaded?.getTime?.();
      if (typeof uploadedAt !== "number") {
        continue;
      }
      const age = now - uploadedAt;
      if (age > maxAgeMs) {
        await bucket.delete(obj.key);
        deleted += 1;
      }
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return { deleted, scanned };
}

