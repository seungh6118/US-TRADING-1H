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
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      const body = await response.text();
      const detail = body.trim().slice(0, 240);
      throw new Error(`FMP request failed for ${path}: ${response.status}${detail ? ` - ${detail}` : ""}`);
    }

    return (await response.json()) as T;
  }
}
