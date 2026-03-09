import { appConfig } from "@/lib/config";
import { ProviderSet } from "@/lib/types";
import { FmpClient } from "@/providers/live/fmp-client";
import {
  LiveCalendarProvider,
  LiveFundamentalsProvider,
  LiveMarketDataProvider,
  LiveNewsProvider,
  OpenAICompatibleProvider
} from "@/providers/live/live-providers";
import {
  MockCalendarProvider,
  MockFundamentalsProvider,
  MockMarketDataProvider,
  MockNewsProvider,
  TemplateAIProvider
} from "@/providers/mock/mock-providers";

export function getProviderSet(): ProviderSet {
  if (appConfig.requestedMode === "mock") {
    return {
      marketDataProvider: new MockMarketDataProvider(),
      newsProvider: new MockNewsProvider(),
      fundamentalsProvider: new MockFundamentalsProvider(),
      calendarProvider: new MockCalendarProvider(),
      aiProvider: new TemplateAIProvider(),
      status: {
        requestedMode: "mock",
        runtimeMode: "mock",
        note: "Mock mode with seeded market, sector, stock, and watchlist data."
      }
    };
  }

  const client = new FmpClient();
  if (!client.configured) {
    return {
      marketDataProvider: new MockMarketDataProvider(),
      newsProvider: new MockNewsProvider(),
      fundamentalsProvider: new MockFundamentalsProvider(),
      calendarProvider: new MockCalendarProvider(),
      aiProvider: new TemplateAIProvider(),
      status: {
        requestedMode: "live",
        runtimeMode: "mock",
        note: "Live mode was requested, but FMP_API_KEY is missing. Falling back to mock providers."
      }
    };
  }

  return {
    marketDataProvider: new LiveMarketDataProvider(client),
    newsProvider: new LiveNewsProvider(client),
    fundamentalsProvider: new LiveFundamentalsProvider(client),
    calendarProvider: new LiveCalendarProvider(),
    aiProvider: new OpenAICompatibleProvider(),
    status: {
      requestedMode: "live",
      runtimeMode: process.env.OPENAI_API_KEY ? "hybrid" : "hybrid",
      note: "Hybrid live mode uses Financial Modeling Prep for stock-level data and keeps sector/theme scaffolding extensible for future vendors."
    }
  };
}
