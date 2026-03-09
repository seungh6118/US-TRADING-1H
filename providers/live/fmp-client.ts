export class FmpClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.FMP_API_KEY ?? "";
    this.baseUrl = process.env.FMP_BASE_URL ?? "https://financialmodelingprep.com/api/v3";
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

    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/${path}?${searchParams.toString()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`FMP request failed for ${path}: ${response.status}`);
    }

    return (await response.json()) as T;
  }
}
