"use client";

export function OvernightDashboardLoadingShell() {
  return (
    <main className="intro-screen">
      <div className="intro-grid" />
      <div className="intro-orb intro-orb-left" />
      <div className="intro-orb intro-orb-right" />

      <section className="loading-card">
        <div className="loading-chip-row">
          <span className="loading-chip loading-chip-warm">API 계산 중</span>
          <span className="loading-chip">S&amp;P500 503종목 스캔</span>
        </div>

        <div className="mt-6">
          <p className="label text-slate-300">Overnight Engine</p>
          <h1 className="loading-title">종가베팅 후보를 압축하고 있습니다</h1>
          <p className="loading-subtitle">
            전체 S&amp;P500을 먼저 훑고, 상위 후보만 재료와 애프터마켓 반응까지 다시 계산한 뒤 대시보드를 엽니다.
          </p>
        </div>

        <div className="loading-progress mt-8">
          <div className="loading-progress-bar" />
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <div className="loading-step">
            <p className="loading-step-index">01</p>
            <p className="loading-step-title">프리스캔</p>
            <p className="loading-step-copy">S&amp;P500 전체 1차 훑기</p>
          </div>
          <div className="loading-step">
            <p className="loading-step-index">02</p>
            <p className="loading-step-title">심화 계산</p>
            <p className="loading-step-copy">뉴스 · 거래량 · 장후 반응 반영</p>
          </div>
          <div className="loading-step">
            <p className="loading-step-index">03</p>
            <p className="loading-step-title">최종 압축</p>
            <p className="loading-step-copy">오늘 볼 3종목만 추리기</p>
          </div>
        </div>
      </section>
    </main>
  );
}
