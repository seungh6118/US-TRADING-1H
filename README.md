# 미국주식 AI 리서치 레이더

한국 거주 투자자를 위한 미국주식 스윙/포지션 후보 압축 리서치 앱입니다.

이 앱은 단순 뉴스 모음이나 차트 뷰어가 아닙니다. 결정론적 점수, 설명 가능한 근거, 일일 감시리스트 스냅샷을 바탕으로 오늘과 이번 주에 볼 만한 종목만 빠르게 좁혀 주는 것이 목적입니다.

## 1. 아키텍처

- 프론트엔드: Next.js App Router, TypeScript, Tailwind CSS, Recharts
- 백엔드: Next.js 서버 컴포넌트 + `app/api` API routes
- 저장소: 기본은 JSON 파일 저장소, 이후 Postgres 같은 외부 DB로 교체 가능한 구조
- 데이터 모드:
  - `mock`: 샘플 시장/섹터/테마/종목/감시리스트 데이터로 즉시 실행
  - `live`: Financial Modeling Prep 기반 실시간 종목 데이터 + 확장 가능한 하이브리드 구조
- AI 사용 범위:
  - 점수 계산은 전부 결정론적 로직
  - AI는 시장 요약, 테마 요약, 종목 설명 보강에만 사용

요청 흐름:

1. Provider factory가 `mock` 또는 `live` 묶음을 선택합니다.
2. Research service가 시장, 섹터, 테마, 종목, 뉴스 데이터를 불러옵니다.
3. Scoring engine이 종목을 결정론적으로 계산하고 정렬합니다.
4. Watchlist service가 일일 스냅샷을 저장하고 전일 대비 변화를 계산합니다.
5. 대시보드와 종목 상세 화면이 설명 가능한 결과를 렌더링합니다.

## 2. 폴더 구조

```text
app/
  api/
    dashboard/
    export/
    health/
    stocks/[ticker]/
    watchlist/
  stocks/[ticker]/
components/
lib/
services/
providers/
  live/
  mock/
scoring/
db/
api/
render.yaml
```

역할 요약:

- `app`: 페이지, 레이아웃, 글로벌 스타일, API 라우트
- `components`: 대시보드 UI, 종목 상세 UI, 차트, 공통 패널/배지
- `lib`: 앱 설정, 상수, 타입, 유틸리티, 로컬라이징 헬퍼
- `services`: 대시보드/상세/감시리스트 오케스트레이션 계층
- `providers`: mock/live 데이터 제공자 구현체
- `scoring`: 결정론적 점수 엔진과 리스크 알림 생성 로직
- `db`: 파일 기반 상태 저장소와 감시리스트 저장소 계층
- `api`: 프론트 fetch 응답 계약
- `render.yaml`: Render 배포용 블루프린트

## 3. 핵심 타입

핵심 계약은 `lib/types.ts`에 있습니다.

주요 타입:

- `MarketMacroSnapshot`: 시장 레짐, 지수, 매크로 자산, 경제 일정, AI 요약
- `SectorPerformance`: 5/20/60일 상대강도와 섹터 점수
- `ThemeSnapshot`: 뉴스 언급량, 감성, 가격 모멘텀, 연결 티커
- `StockSnapshot`: 프로필, 시세, 펀더멘털, 기술지표, 실적, 뉴스, 이벤트, 가격 이력
- `CandidateStock`: 점수, 라벨, 내러티브, 핵심 가격대를 포함한 종목
- `ScoreBreakdown`: 세부 점수와 리스크 패널티, 최종 점수
- `WatchlistSummary`: 오늘 스냅샷, 저장 종목, 제거 종목, 점수 변화
- `ProviderSet`: 시장/뉴스/펀더멘털/캘린더/AI 인터페이스 묶음

## 4. 점수 엔진

점수 계산은 `scoring/engine.ts`에 있으며, 전부 결정론적입니다.

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

가중치는 `lib/config.ts`에서 조정합니다.

구현된 점수 항목:

- `macroFit`: 레짐, VIX, 달러, 섹터 베타 적합도
- `sectorStrength`: 섹터 상대강도와 5/20/60일 성과
- `themeStrength`: 종목 테마에 연결된 테마 점수
- `earningsNews`: 매출 성장, EPS 서프라이즈, 가이던스, 추정치 변화, 뉴스 감성
- `priceStructure`: 이동평균 배열, 52주 고점 근접도, 눌림 품질, 거래량 동반 여부
- `flowVolume`: 거래량 이상치와 단기 가속도
- `valuationSanity`: 섹터 특성 기준의 밸류에이션 sanity check
- `riskPenalty`: 실적 임박, ATR 과열, 과도한 상승, 부정적 뉴스, 가이던스 하향

생성되는 라벨:

- `돌파 후보`
- `눌림목 후보`
- `실적 체크`
- `감시`
- `회피`

모든 종목에는 아래 설명이 붙습니다.

- 왜 보는가
- 왜 아직 아닌가
- 무엇이 확인되면 유효한가
- 무엇이 깨지면 무효인가

## 5. Mock 데이터 제공자

Mock 모드는 실제 앱 형태와 비슷하게 구성되어 있어 바로 실행할 수 있습니다.

포함 내용:

- 시장 레짐 요약
- 주요 지수와 매크로 자산
- 섹터/테마 리더보드
- 반도체, 메가캡 플랫폼, 사이버보안, 전력 인프라, 방산, 헬스케어, 소비재 등 20개 샘플 종목
- 차트와 이동평균 계산용 합성 가격 이력
- 뉴스 요약, 실적 일정, 이벤트 캘린더
- 기본 저장 감시리스트와 일일 스냅샷 이력

주요 파일:

- `providers/mock/mock-data.ts`
- `providers/mock/mock-providers.ts`

## 6. 프론트엔드 페이지 / 컴포넌트

주요 경로:

- `/`: 필수 5개 섹션이 들어간 대시보드
- `/stocks/[ticker]`: 차트, 핵심 지표, 내러티브, 뉴스, 이벤트, 동종 후보를 보여주는 상세 페이지

핵심 컴포넌트:

- `components/dashboard-client.tsx`
- `components/stock-detail-view.tsx`
- `components/price-chart.tsx`
- `components/ui.tsx`

첫 화면 구성:

- 시장 레짐 요약
- 강한 섹터 / 테마
- 상위 종목 후보
- 리스크 경보
- 내 감시리스트

추가 출력:

- 오늘 바로 볼 Top 3
- Top 5 감시리스트
- 회피 리스트 3
- CSV 내보내기
- 신규 후보 / 제거 종목 구분
- 모바일 대응 레이아웃

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

### 헬스 체크

```text
GET /api/health
```

배포 상태와 영구 저장소 설정 여부를 JSON으로 반환합니다.

### 이 워크스페이스에서 검증한 항목

- `npm run build`: 통과
- 로컬 런타임 확인: 홈 화면 HTML 응답 정상
- 한국어 UI 문자열 확인: 정상

## 8. 환경변수 예시

`.env.example`을 시작점으로 사용하면 됩니다.

```env
APP_DATA_MODE=mock
APP_DEFAULT_UNIVERSE=sp500
APP_TIMEZONE=Asia/Seoul
APP_DB_PATH=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
FMP_API_KEY=
FMP_BASE_URL=https://financialmodelingprep.com/api/v3
APP_CUSTOM_TICKERS=
```

모드 동작:

- `mock`: 샘플 데이터로 즉시 실행
- `live`: Financial Modeling Prep 기반 실시간 데이터 시도
- `live`인데 `FMP_API_KEY`가 없으면 자동으로 mock 데이터로 폴백
- `APP_DB_PATH`: 외부 영구 디스크를 쓸 때 파일 저장 경로를 지정

## 9. 실시간 API 연동 TODO

현재 실시간 모드는 의도적으로 하이브리드 구조입니다. 종목 단위 실시간 fetch는 이미 가능하지만, 다음 확장이 권장됩니다.

- VIX, 미국채 2년물, 미국채 10년물, DXY, WTI, Gold를 정확한 공급자로 교체
- 섹터 ETF와 테마 바스켓 성과 공급자 추가
- 실제 실적 캘린더, 내부자 매매, 희석, 규제 리스크 데이터 추가
- EPS revision / estimate-change 공급자 추가
- 공급자별 캐시와 rate limit 처리 추가
- 공급자별 재시도와 상태 모니터링 추가
- 환경변수 기반이 아닌 사용자 지정 유니버스 저장 구조 추가
- 동일한 저장소 인터페이스를 구현하는 Postgres 저장소 추가
- 필요 시 예약 스냅샷 생성 기능 추가

## Render 배포

이 저장소는 현재 `render.yaml` 기준으로 Render Free 배포에 맞춰져 있습니다.

권장 흐름:

1. 이 프로젝트를 GitHub 저장소에 푸시합니다.
2. Render에서 해당 저장소로 새 Blueprint 서비스를 만듭니다.
3. Render가 `render.yaml`을 읽고 무료 Node 웹서비스를 생성합니다.
4. 첫 배포가 성공하면 환경변수에 아래를 추가합니다.
   - `FMP_API_KEY`
   - `OPENAI_API_KEY`
5. 실제 데이터로 전환할 때 `APP_DATA_MODE`를 `live`로 바꿉니다.

무료 플랜 주의사항:

- Render Free는 일정 시간 트래픽이 없으면 슬립됩니다.
- 다음 요청 때 30초에서 60초 정도 깨우는 시간이 걸릴 수 있습니다.
- 무료 웹서비스 파일시스템은 영구 보장이 없어서 감시리스트 저장 데이터가 재시작 후 초기화될 수 있습니다.
- 영구 저장이 필요하면 Postgres 같은 외부 DB로 저장 계층을 옮기는 것이 좋습니다.

## Docker

`Dockerfile`도 포함되어 있습니다.

```bash
docker build -t us-stock-ai-research .
docker run --rm -p 3000:3000 --env-file .env us-stock-ai-research
```

컨테이너 바깥 경로에 상태 파일을 저장하려면 `APP_DB_PATH`를 마운트 경로로 지정하면 됩니다.

## 메모

- 현재 watchlist 생성기는 자동 매매가 아니라 후보 압축용 도구입니다.
- 설치된 의존성 중 일부는 배포 전 추가 점검이 권장됩니다.