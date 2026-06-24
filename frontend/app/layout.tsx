import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "골목 방패 — 마포구 카페 창업 입지 추천",
  description: "AI 기반 마포구 카페 창업 입지 추천 서비스. 5가지 질문으로 나에게 맞는 골목을 찾아드려요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
