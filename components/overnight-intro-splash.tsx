"use client";

export function OvernightIntroSplash() {
  return (
    <main className="intro-screen">
      <div className="intro-grid" />
      <div className="intro-orb intro-orb-left" />
      <div className="intro-orb intro-orb-right" />

      <section className="intro-card">
        <div className="loading-chip-row">
          <span className="loading-chip">S&amp;P500 Overnight</span>
          <span className="loading-chip loading-chip-warm">Close-to-Open Scanner</span>
        </div>

        <div className="mt-7">
          <p className="label text-slate-300">US Close Bet Research</p>
          <h1 className="intro-title">
            미국주식
            <br />
            종가베팅 스캐너
          </h1>
          <p className="intro-subtitle">
            장마감 10~15분 전에 익일 갭과 시초 강세 가능성이 높은 종목만 압축해 보여주는 오버나이트 시그널 보드입니다.
          </p>
        </div>

        <div className="intro-marquee mt-8">
          <span>실적</span>
          <span>애프터마켓</span>
          <span>뉴스</span>
          <span>RVOL</span>
          <span>VWAP</span>
          <span>리스크</span>
          <span>갭 플레이</span>
        </div>
      </section>
    </main>
  );
}
