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
        note: "샘플 데이터로 시장 요약, 후보 종목, 감시리스트 흐름을 바로 확인할 수 있는 모의 모드입니다."
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
        note: "실시간 모드를 선택했지만 FMP_API_KEY가 없어 모의 데이터로 자동 전환되었습니다."
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
      note: "실시간 시세와 뉴스에 AI 설명을 결합한 혼합 모드입니다."
    }
  };
}
