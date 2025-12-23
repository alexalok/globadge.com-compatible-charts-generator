import { ChartDimensions, ChartMargins, NumericAxisOptions, TimeAxisOptions, TimeUnit } from "../types";

export const DEFAULT_MARGINS: ChartMargins = {
  top: 28,
  right: 20,
  bottom: 38,
  left: 52,
};

export const DEFAULT_COLORS = [
  "#2563eb",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#14b8a6",
  "#e11d48",
  "#0ea5e9",
];

export function mergeMargins(custom?: Partial<ChartMargins>): ChartMargins {
  return {
    top: custom?.top ?? DEFAULT_MARGINS.top,
    right: custom?.right ?? DEFAULT_MARGINS.right,
    bottom: custom?.bottom ?? DEFAULT_MARGINS.bottom,
    left: custom?.left ?? DEFAULT_MARGINS.left,
  };
}

export function normalizeDimensions(dimensions: ChartDimensions): ChartDimensions & { margin: ChartMargins } {
  const width = Math.max(100, Math.round(dimensions.width || 800));
  const height = Math.max(100, Math.round(dimensions.height || 400));
  return {
    ...dimensions,
    width,
    height,
    margin: mergeMargins(dimensions.margin),
  };
}

export function parseDate(value: number | string | Date): number {
  if (value instanceof Date) return value.getTime();
  const asNumber = typeof value === "number" ? value : Date.parse(value);
  if (Number.isNaN(asNumber)) {
    throw new Error(`Invalid date value: ${String(value)}`);
  }
  return asNumber;
}

export function createLinearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const m = (r1 - r0) / (d1 - d0 || 1);
  return (value: number) => r0 + (value - d0) * m;
}

export function createTimeScale(domain: [number, number], range: [number, number]) {
  return createLinearScale(domain, range);
}

const E10 = Math.sqrt(50);
const E5 = Math.sqrt(10);
const E2 = Math.sqrt(2);

export function tickStep(start: number, stop: number, count: number) {
  const step0 = Math.abs(stop - start) / Math.max(1, count);
  const power = Math.floor(Math.log10(step0));
  const error = step0 / 10 ** power;
  const step =
    error >= E10
      ? 10
      : error >= E5
        ? 5
        : error >= E2
          ? 2
          : 1;
  return (step * 10 ** power) * Math.sign(stop - start || 1);
}

export function niceLinearDomain(domain: [number, number], count: number): [number, number] {
  const [start, stop] = domain;
  if (start === stop) {
    const delta = Math.abs(start || 1);
    return [start - delta, stop + delta];
  }
  const step = tickStep(start, stop, count);
  const niceStart = Math.floor(start / step) * step;
  const niceStop = Math.ceil(stop / step) * step;
  return [niceStart, niceStop];
}

export function linearTicks(domain: [number, number], count: number): number[] {
  const [start, stop] = domain;
  if (start === stop) return [start];
  const step = tickStep(start, stop, count);
  const ticks: number[] = [];
  const startTick = Math.ceil(Math.min(start, stop) / step);
  const endTick = Math.floor(Math.max(start, stop) / step);
  for (let i = startTick; i <= endTick; i += 1) {
    ticks.push(i * step);
  }
  return ticks;
}

const MS = {
  millisecond: 1,
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_629_746_000, // average
  year: 31_556_952_000, // average
};

const TIME_STEPS: Record<Exclude<TimeUnit, "auto">, number[]> = {
  year: [1, 2, 5, 10],
  month: [1, 3, 6],
  week: [1, 2, 4],
  day: [1, 2, 3, 7],
  hour: [1, 3, 6, 12],
  minute: [1, 5, 15, 30],
  second: [1, 5, 15, 30],
  millisecond: [1, 5, 10, 50, 100, 250, 500],
};

export interface TimeTickResult {
  unit: Exclude<TimeUnit, "auto">;
  step: number;
}

export function chooseTimeInterval(start: number, stop: number, desiredCount: number): TimeTickResult {
  const span = Math.abs(stop - start);
  let best: TimeTickResult = { unit: "day", step: 1 };
  let bestScore = Number.POSITIVE_INFINITY;

  (Object.keys(TIME_STEPS) as Exclude<TimeUnit, "auto">[]).forEach((unit) => {
    const base = MS[unit];
    TIME_STEPS[unit].forEach((step) => {
      const approx = span / (base * step);
      const score = Math.abs(approx - desiredCount);
      if (score < bestScore) {
        bestScore = score;
        best = { unit, step };
      }
    });
  });

  return best;
}

export function floorDate(date: Date, unit: Exclude<TimeUnit, "auto">, step: number): Date {
  const d = new Date(date);
  switch (unit) {
    case "year": {
      const year = Math.floor(d.getUTCFullYear() / step) * step;
      d.setUTCFullYear(year, 0, 1);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    case "month": {
      const month = Math.floor(d.getUTCMonth() / step) * step;
      d.setUTCMonth(month, 1);
      d.setUTCHours(0, 0, 0, 0);
      return d;
    }
    case "week": {
      const ms = d.getTime();
      const stepMs = step * MS.week;
      const aligned = Math.floor(ms / stepMs) * stepMs;
      return new Date(aligned);
    }
    case "day": {
      const ms = d.getTime();
      const stepMs = step * MS.day;
      const aligned = Math.floor(ms / stepMs) * stepMs;
      return new Date(aligned);
    }
    case "hour": {
      const ms = d.getTime();
      const stepMs = step * MS.hour;
      const aligned = Math.floor(ms / stepMs) * stepMs;
      return new Date(aligned);
    }
    case "minute": {
      const ms = d.getTime();
      const stepMs = step * MS.minute;
      const aligned = Math.floor(ms / stepMs) * stepMs;
      return new Date(aligned);
    }
    case "second": {
      const ms = d.getTime();
      const stepMs = step * MS.second;
      const aligned = Math.floor(ms / stepMs) * stepMs;
      return new Date(aligned);
    }
    case "millisecond": {
      const ms = d.getTime();
      const stepMs = step * MS.millisecond;
      const aligned = Math.floor(ms / stepMs) * stepMs;
      return new Date(aligned);
    }
  }
}

export function addToDate(date: Date, unit: Exclude<TimeUnit, "auto">, step: number): Date {
  const d = new Date(date);
  switch (unit) {
    case "year":
      d.setUTCFullYear(d.getUTCFullYear() + step);
      return d;
    case "month":
      d.setUTCMonth(d.getUTCMonth() + step);
      return d;
    case "week":
      d.setUTCDate(d.getUTCDate() + step * 7);
      return d;
    case "day":
      d.setUTCDate(d.getUTCDate() + step);
      return d;
    case "hour":
      d.setUTCHours(d.getUTCHours() + step);
      return d;
    case "minute":
      d.setUTCMinutes(d.getUTCMinutes() + step);
      return d;
    case "second":
      d.setUTCSeconds(d.getUTCSeconds() + step);
      return d;
    case "millisecond":
      d.setUTCMilliseconds(d.getUTCMilliseconds() + step);
      return d;
  }
}

export function timeTicks(start: number, stop: number, axis: TimeAxisOptions, plotWidth?: number): Date[] {
  const span = Math.max(1, Math.abs(stop - start));
  const fallbackWidth = typeof plotWidth === "number" && Number.isFinite(plotWidth) ? plotWidth : 720;
  const autoCount = Math.round(fallbackWidth / 90); // aim for ~90px between ticks
  const desiredCount = axis.tickCount ?? Math.max(3, Math.min(60, autoCount));
  const unit = axis.unit === undefined || axis.unit === "auto" ? "auto" : axis.unit;
  const { unit: resolvedUnit, step } =
    unit === "auto" ? chooseTimeInterval(start, stop, desiredCount) : { unit, step: 1 };

  const first = floorDate(new Date(start), resolvedUnit, step);
  const ticks: Date[] = [];
  for (let current = first; current.getTime() <= stop + 1; current = addToDate(current, resolvedUnit, step)) {
    if (current.getTime() >= start - 1) {
      ticks.push(new Date(current));
    }
  }
  if (ticks.length === 0) ticks.push(new Date(start));
  return ticks;
}

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pad(value: number, size: number): string {
  return String(Math.trunc(value)).padStart(size, "0");
}

export function formatDateUTC(date: Date, format = "%Y-%m-%d"): string {
  return format.replace(/%[aAbBdeHImMSyYjLZ]/g, (token) => {
    switch (token) {
      case "%Y":
        return pad(date.getUTCFullYear(), 4);
      case "%y":
        return pad(date.getUTCFullYear() % 100, 2);
      case "%m":
        return pad(date.getUTCMonth() + 1, 2);
      case "%B":
        return MONTHS_FULL[date.getUTCMonth()];
      case "%b":
        return MONTHS_SHORT[date.getUTCMonth()];
      case "%d":
        return pad(date.getUTCDate(), 2);
      case "%e": {
        const day = date.getUTCDate();
        return day < 10 ? ` ${day}` : String(day);
      }
      case "%H":
        return pad(date.getUTCHours(), 2);
      case "%M":
        return pad(date.getUTCMinutes(), 2);
      case "%S":
        return pad(date.getUTCSeconds(), 2);
      case "%L":
        return pad(date.getUTCMilliseconds(), 3);
      case "%a":
        return DAYS_SHORT[date.getUTCDay()];
      case "%A":
        return DAYS_FULL[date.getUTCDay()];
      case "%I": {
        const hour = date.getUTCHours();
        const h12 = hour % 12 || 12;
        return pad(h12, 2);
      }
      case "%j": {
        const start = Date.UTC(date.getUTCFullYear(), 0, 0);
        const diff = date.getTime() - start;
        return pad(Math.floor(diff / MS.day), 3);
      }
      case "%Z":
        return "UTC";
      default:
        return token;
    }
  });
}

export function formatNumber(value: number, format?: string): string {
  if (typeof format === "string" && /^\.?\d+f$/.test(format)) {
    const digits = Number.parseInt(format.replace(/\D/g, ""), 10);
    return value.toFixed(digits);
  }
  const abs = Math.abs(value);
  const maximumFractionDigits = abs > 1000 ? 0 : abs > 100 ? 1 : abs > 10 ? 2 : 3;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

export interface LinePoint {
  x: number;
  y: number;
}

export interface AreaPoint {
  x: number;
  y0: number;
  y1: number;
}

export function isSameUtcDay(a: number | Date, b: number | Date): boolean {
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

export function linePath(points: LinePoint[]): string {
  if (!points.length) return "";
  const commands = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`);
  return commands.join(" ");
}

export function areaPath(points: AreaPoint[]): string {
  if (!points.length) return "";
  const upper = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y1}`).join(" ");
  const lower = points
    .slice()
    .reverse()
    .map((p, i) => `${i === 0 ? "L" : "L"}${p.x},${p.y0}`)
    .join(" ");
  return `${upper} ${lower} Z`;
}

export function resolveAxisFont(axis: { fontFamily?: string; fontSize?: number }) {
  return {
    fontFamily: axis.fontFamily ?? "Inter, system-ui, sans-serif",
    fontSize: axis.fontSize ?? 11,
  };
}

export function escapeXml(text: string | number | undefined | null): string {
  if (text == null) return "";
  const str = String(text);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function computeYDomain(values: number[], axis?: NumericAxisOptions): [number, number] {
  if (!values.length) return [0, 1];
  const min = axis?.domain?.[0] ?? Math.min(...values);
  const max = axis?.domain?.[1] ?? Math.max(...values);
  if (min === max) {
    const delta = Math.abs(min || 1);
    return [min - delta, max + delta];
  }
  const nice = axis?.nice ?? true;
  return nice ? niceLinearDomain([min, max], axis?.tickCount ?? 6) : [min, max];
}

