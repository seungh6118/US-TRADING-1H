import { appConfig } from "@/lib/config";
import { LiveDataUnavailableError } from "@/lib/errors";
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
        note: "샘플 데이터로 시장 구조를 미리 보는 모의 모드입니다. 실시간 시세 정확도 용도로 쓰면 안 됩니다."
      }
    };
  }

  const client = new FmpClient();
  if (!client.configured && appConfig.strictLiveMode) {
    throw new LiveDataUnavailableError("실시간 정확도 모드를 사용하려면 FMP_API_KEY가 필요합니다.");
  }

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
        note: "실시간 모드가 요청되었지만 API 키가 없어 모의 데이터로 동작 중입니다. 정확한 판단에는 사용할 수 없습니다."
      }
    };
  }

  const runtimeMode = process.env.OPENAI_API_KEY ? "hybrid" : "live";

  return {
    marketDataProvider: new LiveMarketDataProvider(client),
    newsProvider: new LiveNewsProvider(client),
    fundamentalsProvider: new LiveFundamentalsProvider(client),
    calendarProvider: new LiveCalendarProvider(client),
    aiProvider: new OpenAICompatibleProvider(),
    status: {
      requestedMode: "live",
      runtimeMode,
      note:
        runtimeMode === "hybrid"
          ? "실시간 시세와 뉴스를 기반으로 점수를 계산하고, AI는 설명 보강에만 사용합니다."
          : "실시간 시세와 뉴스를 기반으로 점수를 계산하는 실전 모드입니다."
    }
  };
}
