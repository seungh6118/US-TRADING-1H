export function DashboardLoadingShell({
  message = "시장 데이터를 계산 중입니다."
}: {
  message?: string;
}) {
  return (
    <main className="mx-auto max-w-[1480px] px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
      <section className="hero-panel mb-6">
        <div className="grid gap-6 px-5 py-6 sm:px-6 lg:px-8 lg:py-8 xl:grid-cols-[1.18fr_0.82fr]">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="pill">서비스 준비 중</span>
              <span className="pill">첫 접속은 조금 더 걸릴 수 있습니다</span>
            </div>
            <h1 className="max-w-4xl text-4xl leading-tight text-slate-50 sm:text-5xl lg:text-[3.55rem]">
              미국장을 오래 읽지 않아도,
              <br />
              핵심 흐름이 먼저 보이게
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-200/90">
              {message} 무료 Render 환경에서는 슬립 복구와 데이터 계산 때문에 첫 진입이 30초 이상 걸릴 수 있습니다.
              화면은 바로 열어두고 잠시만 기다려 주세요.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="hero-stat animate-pulse">
                  <div className="h-3 w-20 rounded bg-white/10" />
                  <div className="mt-3 h-8 w-14 rounded bg-white/10" />
                  <div className="mt-3 h-3 w-32 rounded bg-white/10" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="hero-stat animate-pulse">
                <div className="h-3 w-16 rounded bg-white/10" />
                <div className="mt-4 h-9 w-20 rounded bg-white/10" />
                <div className="mt-4 h-3 w-28 rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="panel p-5 sm:p-6">
          <div className="mb-5 border-b border-white/6 pb-4">
            <p className="label">보드</p>
            <h2 className="panel-title mt-2">오늘의 시장 스캔맵</h2>
            <p className="panel-subtitle">레이아웃은 먼저 띄우고, 실제 시장 데이터는 뒤에서 순서대로 계산하고 있습니다.</p>
          </div>
          <div className="grid auto-rows-[138px] grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="heat-tile heat-tile-neutral animate-pulse">
                <div className="h-5 w-24 rounded bg-white/10" />
                <div className="mt-3 h-4 w-36 rounded bg-white/10" />
                <div className="mt-5 h-16 rounded bg-black/10" />
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5 sm:p-6">
          <div className="mb-5 border-b border-white/6 pb-4">
            <p className="label">보드</p>
            <h2 className="panel-title mt-2">액션 보드</h2>
            <p className="panel-subtitle">후보 압축과 감시리스트는 데이터가 준비되는 즉시 자동으로 채워집니다.</p>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-[18px] border border-white/8 bg-white/5 px-4 py-4 animate-pulse">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="mt-3 h-3 w-full rounded bg-white/10" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
