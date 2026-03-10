# 미국주식 AI 리서치 레이더

한국 거주 사용자가 미국장을 계속 보지 못하는 상황을 전제로 만든, 스윙/포지션용 미국주식 후보 압축 웹앱입니다.

핵심 원칙은 다음과 같습니다.

- 점수 계산은 결정론적 로직으로 수행
- AI는 설명, 요약, 감시 포인트 정리에만 사용
- `mock`는 데모 전용
- `live`는 실제 시세와 뉴스 기반
- `live`에서 API 키가 없으면 실시간 앱인 척 속이지 않고 명확히 설정 필요 상태를 표시

## 1. 아키텍처

- 프론트엔드: Next.js App Router, TypeScript, Tailwind CSS
- 백엔드: Next.js 서버 컴포넌트 + `app/api` API routes
- 저장소: 파일 기반 watchlist 저장 구조
- 실시간 데이터: Financial Modeling Prep provider
- AI: OpenAI-compatible abstraction layer

흐름은 다음과 같습니다.

1. `providers/factory.ts`가 `mock` 또는 `live` provider 세트를 선택합니다.
2. `services/research-service.ts`가 시장, 종목, 뉴스, 캘린더를 모읍니다.
3. `services/live-analytics.ts`가 live 모드에서 섹터 강도와 테마 모멘텀을 실제 종목 데이터로 계산합니다.
4. `scoring/engine.ts`가 종목 점수를 결정론적으로 계산합니다.
5. UI는 결과를 대시보드와 종목 상세 페이지로 설명 가능하게 렌더링합니다.

## 2. 폴더 구조

```text
app/
  api/
  stocks/[ticker]/
components/
lib/
providers/
  live/
  mock/
services/
scoring/
db/
api/
render.yaml
```

주요 역할:

- `app`: 페이지, 라우트, 서버 렌더링 진입점
- `components`: 대시보드, 상세, 차트, 경고 패널 UI
- `lib`: 타입, 설정, 상수, 로컬라이제이션, 유틸
- `providers`: mock/live 데이터 공급자
- `services`: 대시보드 조립, watchlist, live 분석
- `scoring`: 종목 점수와 라벨 계산

## 3. 핵심 타입

핵심 타입은 `lib/types.ts`에 있습니다.

- `MarketMacroSnapshot`: 시장 레짐, 지수, 거시 자산, 경제 일정
- `SectorPerformance`: 5/20/60일 상대강도 기반 섹터 점수
- `ThemeSnapshot`: 뉴스 언급량, 감성, 가격 반응 기반 테마 점수
- `StockSnapshot`: 프로필, 시세, 기술적 지표, 실적, 뉴스, 이벤트
- `CandidateStock`: 점수, 라벨, 서술형 근거가 결합된 감시 후보
- `WatchlistSummary`: 오늘 감시리스트와 전일 대비 변화
- `ProviderSet`: market/news/fundamentals/calendar/ai provider 묶음

## 4. 점수 엔진

점수 계산은 `scoring/engine.ts`에 있습니다.

```ts
finalScore =
  0.15 * macroFit +
  0.20 * sectorStrength +
  0.15 * themeStrength +
  0.15 * earningsNews +
  0.20 * priceStructure +
  0.10 * flowVolume +
  0.05 * valuationSanity -
  riskPenalty;
```

세부 점수:

- `macroFit`: 시장 레짐, VIX, 달러, 금리 방향
- `sectorStrength`: 5/20/60일 상대강도
- `themeStrength`: 테마 연결도와 테마 점수
- `earningsNews`: 실적 서프라이즈, 가이던스, 뉴스 감성
- `priceStructure`: 이동평균 구조, 52주 고점 대비 위치, 거래량
- `flowVolume`: 거래량 비율과 단기 가속도
- `valuationSanity`: 섹터 성격 대비 밸류 sanity check
- `riskPenalty`: 실적 임박, 과열, 악재 뉴스, 변동성

## 5. Mock 모드

`mock` 모드는 데모 전용입니다.

- 앱을 즉시 실행해서 화면과 흐름을 확인할 수 있습니다.
- 샘플 숫자이므로 실시간 투자 판단에 쓰면 안 됩니다.
- UI에 명시적인 경고가 표시됩니다.

관련 파일:

- `providers/mock/mock-data.ts`
- `providers/mock/mock-providers.ts`

## 6. Live 모드

`live` 모드는 실제 데이터용입니다.

현재 live 모드에서 하는 일:

- FMP 기반 종목 현재가, 거래량, 시가총액, 평균 거래량 조회
- 가격 이력으로 20/50/200일선, 52주 고점, 상대 위치 계산
- 종목 뉴스, 실적 서프라이즈, 실적 캘린더 반영
- 실시간 종목 스냅샷으로 섹터 강도와 테마 모멘텀 재계산
- Power Infrastructure 유니버스 추가
  - `VRT`, `ETN`, `GEV`, `CEG`, `BE`, `VST`, `NRG`, `TLN`, `BWXT`

중요:

- `APP_DATA_MODE=live`
- `APP_STRICT_LIVE_MODE=true`
- `FMP_API_KEY` 설정

이 세 조건이 맞지 않으면 실시간 앱인 척 하지 않고 설정 필요 상태를 보여줍니다.

관련 파일:

- `providers/live/live-providers.ts`
- `services/live-analytics.ts`
- `providers/factory.ts`

## 7. 실행 방법

### 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 엽니다.

### 프로덕션 확인

```bash
npm run build
npm run start
```

### 상태 확인

```text
GET /api/health
```

예시:

- mock 모드: `ok: true`, `runtimeMode: "mock"`
- live 모드인데 키 없음: `503` + 설정 필요 메시지
- live 모드 정상: `ok: true`, `runtimeMode: "live"` 또는 `"hybrid"`

## 8. 환경 변수 예시

`.env.example`를 기준으로 설정합니다.

```env
APP_DATA_MODE=mock
APP_STRICT_LIVE_MODE=true
APP_DEFAULT_UNIVERSE=sp500
APP_TIMEZONE=Asia/Seoul
APP_DB_PATH=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
FMP_API_KEY=
FMP_BASE_URL=https://financialmodelingprep.com/stable
APP_CUSTOM_TICKERS=
```

실시간 정확도용 권장 값:

```env
APP_DATA_MODE=live
APP_STRICT_LIVE_MODE=true
FMP_API_KEY=your_key
```

## 9. Render 배포

현재 `render.yaml`은 무료 Render에서 기본적으로 `mock` 모드로 뜨도록 되어 있습니다.

이유:

- FMP 키 없이 live로 올리면 health check가 실패합니다.
- 그래서 배포는 mock로 유지하고, 실제 사용 시 Render 환경 변수에서 live로 전환하는 방식이 안전합니다.

Render에서 실시간 모드로 전환하려면:

1. 서비스 `Environment`로 이동
2. `FMP_API_KEY` 추가
3. 필요하면 `OPENAI_API_KEY` 추가
4. `APP_DATA_MODE=live`
5. `APP_STRICT_LIVE_MODE=true`
6. 재배포

## 10. Live API 연동 TODO

아직 남아 있는 실전 보강 항목:

- FMP plan별 지연 시간과 호출 제한을 감안한 캐시 정책 추가
- 실적 revision estimate 공급자 추가
- insider sell, dilution, regulatory risk 공급자 추가
- 더 넓은 미국주식 유니버스 스캐너 추가
- watchlist 저장소를 Postgres로 전환 가능한 어댑터 추가
- live data freshness 표시와 last update 타임스탬프 강화

## 11. 검증

현재 로컬에서 확인한 항목:

- `npm run build` 통과
- strict live 타입 검사 통과
- live provider 기반 섹터/테마 계산 빌드 통과

## 12. 참고

FMP stable API 문서는 공식 문서를 기준으로 맞췄습니다.

- [FMP stable API landing](https://site.financialmodelingprep.com/developer/docs/stable)
- [FMP stable quote endpoint](https://site.financialmodelingprep.com/developer/docs/stable/stock-quote-api)
- [FMP stable profile endpoint](https://site.financialmodelingprep.com/developer/docs/stable/company-profile-api)
