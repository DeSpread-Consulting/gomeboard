// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers"; // 위에서 수정한 Providers
import AuthWrapper from "./components/AuthWrapper"; // 위에서 만든 Wrapper

export const metadata: Metadata = {
  title: "gomeboard",
  description: "Unified Operations Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@700,600,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-[#F5F5F7]">
        <Providers>
          {/* AuthWrapper가 로그인 여부를 판단해 화면을 통제합니다 */}
          <AuthWrapper>{children}</AuthWrapper>
        </Providers>
      </body>
    </html>
  );
}
