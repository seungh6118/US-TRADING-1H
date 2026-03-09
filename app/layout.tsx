import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "미국주식 AI 리서치 레이더",
  description: "한국 거주 투자자를 위한 미국주식 스윙/포지션 후보 압축 리서치 앱입니다."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}