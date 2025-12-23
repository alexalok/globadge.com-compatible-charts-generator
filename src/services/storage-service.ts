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

