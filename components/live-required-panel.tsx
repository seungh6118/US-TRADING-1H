export function LiveRequiredPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-amber-400/20 bg-surface-900/90 p-8 shadow-2xl shadow-black/30">
        <p className="text-sm font-medium text-amber-300">실시간 모드 설정 필요</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-50">{title}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">{detail}</p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-300">
          무료로 쓰려면 `APP_DATA_MODE=live` 와 `APP_LIVE_PROVIDER=yahoo` 조합을 권장합니다. FMP를 쓰려면 `APP_LIVE_PROVIDER=fmp` 와 `FMP_API_KEY`가 필요합니다.
        </div>
      </div>
    </main>
  );
}
