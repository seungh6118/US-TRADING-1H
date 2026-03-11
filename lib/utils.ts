const APP_TIMEZONE = "Asia/Seoul";

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatCurrency(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: APP_TIMEZONE,
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: APP_TIMEZONE,
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function getDateOffset(days: number): string {
  const base = new Date();
  const next = new Date(base);
  next.setDate(base.getDate() + days);
  return next.toISOString();
}

export function getLocalIsoDate(): string {
  return toIsoDateInTimezone(new Date(), APP_TIMEZONE);
}

export function daysUntil(date: string | null): number {
  if (!date) {
    return 999;
  }

  const target = new Date(date).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function movingAverage(values: number[], window: number): number {
  return average(values.slice(-window));
}

export function toIsoDateInTimezone(value: Date | string, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(new Date(value))
    .replaceAll("/", "-");
}

export function formatClockInTimezone(value: Date | string, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function pseudoRandom(seed: string): number {
  const hash = seed.split("").reduce((total, char, index) => total + char.charCodeAt(0) * (index + 17), 0);
  const sine = Math.sin(hash) * 10000;
  return sine - Math.floor(sine);
}
