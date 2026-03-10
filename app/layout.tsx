import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_KR } from "next/font/google";
import "@/app/globals.css";

const bodyFont = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-sans"
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--font-mono"
});

export const metadata: Metadata = {
  title: "미국주식 종가베팅 스코어링",
  description: "장마감 직전 오버나이트 갭 플레이 종목을 선별하는 AI 기반 종가베팅 전용 웹앱입니다."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${bodyFont.variable} ${monoFont.variable}`}>{children}</body>
    </html>
  );
}
