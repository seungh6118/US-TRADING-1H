import { appConfig } from "@/lib/config";
import { LiveDataUnavailableError } from "@/lib/errors";
import { ProviderSet } from "@/lib/types";
import {
  YahooFreeCalendarProvider,
  YahooFreeFundamentalsProvider,
  YahooFreeMarketDataProvider,
  YahooFreeNewsProvider
} from "@/providers/free/yahoo-free-providers";
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

function getMockProviderSet(): ProviderSet {
  return {
    marketDataProvider: new MockMarketDataProvider(),
    newsProvider: new MockNewsProvider(),
    fundamentalsProvider: new MockFundamentalsProvider(),
    calendarProvider: new MockCalendarProvider(),
    aiProvider: new TemplateAIProvider(),
    status: {
      requestedMode: "mock",
      runtimeMode: "mock",
      note: "샘플 데이터로 화면과 점수 구조를 확인하는 모의 모드입니다. 실시간 정확도용으로 쓰면 안 됩니다."
    }
  };
}

function getYahooFreeProviderSet(): ProviderSet {
  return {
    marketDataProvider: new YahooFreeMarketDataProvider(),
    newsProvider: new YahooFreeNewsProvider(),
    fundamentalsProvider: new YahooFreeFundamentalsProvider(),
    calendarProvider: new YahooFreeCalendarProvider(),
    aiProvider: new TemplateAIProvider(),
    status: {
      requestedMode: "live",
      runtimeMode: "live",
      note: "Yahoo 무료 가격 데이터를 바탕으로 계산 중입니다. 가격과 차트는 빠르게 반영되지만 뉴스, 실적, 펀더멘털 일부는 제한적이거나 정적 메타데이터를 사용합니다."
    }
  };
}

export function getProviderSet(): ProviderSet {
  if (appConfig.requestedMode === "mock") {
    return getMockProviderSet();
  }

  if (appConfig.liveProvider !== "fmp") {
    return getYahooFreeProviderSet();
  }

  const client = new FmpClient();
  if (!client.configured && appConfig.strictLiveMode) {
    throw new LiveDataUnavailableError("FMP 모드를 사용하려면 FMP_API_KEY가 필요합니다. 무료 사용을 원하면 APP_LIVE_PROVIDER=yahoo 로 두세요.");
  }

  if (!client.configured) {
    return getYahooFreeProviderSet();
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
          ? "실시간 시세와 뉴스로 점수를 계산하고, AI는 설명 문장 보강에만 사용하는 하이브리드 모드입니다."
          : "실시간 시세와 뉴스로 점수를 계산하는 실전 모드입니다."
    }
  };
}
