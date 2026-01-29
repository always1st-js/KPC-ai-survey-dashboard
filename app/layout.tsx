import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI, 어디까지 써봤니? | KPC AI 활용 현황",
  description: "KPC 직원 AI 활용 현황 실시간 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
