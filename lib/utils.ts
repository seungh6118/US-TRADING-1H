import { appConfig } from "@/lib/config";

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
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
    timeZone: appConfig.timezone,
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: appConfig.timezone,
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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: appConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(new Date())
    .replaceAll("/", "-");
}

export function daysUntil(date: string | null): number {
  if (!date) {
    return 999;
  }

  const target = new Date(date).getTime();
  const now = new Date().getTime();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function movingAverage(values: number[], window: number): number {
  const slice = values.slice(-window);
  return average(slice);
}

export function pseudoRandom(seed: string): number {
  const hash = seed.split("").reduce((total, char, index) => {
    return total + char.charCodeAt(0) * (index + 17);
  }, 0);

  const sine = Math.sin(hash) * 10000;
  return sine - Math.floor(sine);
}

export function scoreToSignal(score: number): "strong" | "balanced" | "weak" {
  if (score >= 75) {
    return "strong";
  }

  if (score >= 55) {
    return "balanced";
  }

  return "weak";
}
