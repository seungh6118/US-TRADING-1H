import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "US Stock AI Research Radar",
  description: "Explainable swing and position research workflow for US equities."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
