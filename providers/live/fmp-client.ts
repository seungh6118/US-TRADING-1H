import { ProviderQuotaExceededError } from "@/lib/errors";

type CacheEntry = {
  expiresAt: number;
  data: unknown;
};

const responseCache = new Map<string, CacheEntry>();

function getCacheTtlMs(path: string) {
  if (path === "profile") {
    return 1000 * 60 * 60;
  }

  if (path === "economic-calendar" || path === "earnings-calendar" || path === "treasury-rates") {
    return 1000 * 60 * 15;
  }

  return 1000 * 60 * 5;
}

export class FmpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.FMP_API_KEY ?? "";
    this.baseUrl = process.env.FMP_BASE_URL ?? "https://financialmodelingprep.com/stable";
  }

  get configured(): boolean {
    return Boolean(this.apiKey);
  }

  async request<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const searchParams = new URLSearchParams();
    Object.entries({ ...params, apikey: this.apiKey }).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        searchParams.set(key, String(value));
      }
    });

    const url = `${this.baseUrl.replace(/\/$/, "")}/${path}?${searchParams.toString()}`;
    const now = Date.now();
    const cached = responseCache.get(url);
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      const body = await response.text();
      if (response.status === 429 || body.includes("Limit Reach")) {
        throw new ProviderQuotaExceededError("FMP 무료 키 호출 한도에 도달했습니다. 잠시 후 다시 시도하거나 키가 초기화된 뒤 다시 접속해 주세요.");
      }

      const detail = body.trim().slice(0, 240);
      throw new Error(`FMP request failed for ${path}: ${response.status}${detail ? ` - ${detail}` : ""}`);
    }

    const data = (await response.json()) as T;
    responseCache.set(url, {
      expiresAt: now + getCacheTtlMs(path),
      data
    });
    return data;
  }
}
