export type TimeUnit =
  | "auto"
  | "year"
  | "month"
  | "week"
  | "day"
  | "hour"
  | "minute"
  | "second"
  | "millisecond";

export interface ChartMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartDimensions {
  width: number;
  height: number;
  margin?: Partial<ChartMargins>;
  background?: string;
}

export interface AxisBase {
  label?: string;
  color?: string;
  tickColor?: string;
  tickCount?: number;
  fontFamily?: string;
  fontSize?: number;
}

export interface TimeAxisOptions extends AxisBase {
  unit?: TimeUnit;
  format?: string;
  nice?: boolean;
}

export interface NumericAxisOptions extends AxisBase {
  domain?: [number, number];
  format?: string;
  nice?: boolean;
}

export interface GridOptions {
  x?: boolean;
  y?: boolean;
  color?: string;
  opacity?: number;
}

export interface LegendOptions {
  show?: boolean;
  position?: "top" | "bottom";
  fontSize?: number;
  fontFamily?: string;
}

export interface TimeValue {
  t: number | string | Date;
  v: number;
}

export interface LineSeries {
  id: string;
  name?: string;
  color?: string;
  strokeWidth?: number;
  data: TimeValue[];
}

export interface AreaSeries {
  id: string;
  name?: string;
  color?: string;
  opacity?: number;
  data: TimeValue[];
}

export interface LineChartRequest {
  kind?: "line";
  title?: string;
  description?: string;
  dimensions: ChartDimensions;
  x: TimeAxisOptions;
  y: NumericAxisOptions;
  series: LineSeries[];
  grid?: GridOptions;
  legend?: LegendOptions;
}

export interface StackedAreaChartRequest {
  kind?: "stacked-area";
  title?: string;
  description?: string;
  dimensions: ChartDimensions;
  x: TimeAxisOptions;
  y?: NumericAxisOptions;
  series: AreaSeries[];
  grid?: GridOptions;
  legend?: LegendOptions;
}

export type ChartRequest = LineChartRequest | StackedAreaChartRequest;

export interface ChartResponse {
  svg: string;
  width: number;
  height: number;
}

export interface Env {
  CHARTS_BUCKET: R2Bucket;
  CHART_RETENTION_MAX_AGE?: string;
}

